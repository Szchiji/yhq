const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const Report = require('../../models/Report');
const Admin = require('../../models/Admin');
const config = require('../../config');
const { escapeLike } = require('../../utils/sanitize');
const { buildChannelMessageUrl } = require('../../bot/keyboards');

/**
 * Get publish channel list: PUBLISH_CHATS env var > admin DB config.
 */
async function getPublishChats(adminConfig) {
  if (config.PUBLISH_CHATS && config.PUBLISH_CHATS.length > 0) {
    return config.PUBLISH_CHATS;
  }
  return adminConfig?.pushChannelId ? [adminConfig.pushChannelId] : [];
}

/**
 * Submit a new report (from Mini App)
 */
async function submitReport(req, res) {
  try {
    const { userId, username, firstName, title, description, content, tags } = req.body;
    const report = await Report.create({
      userId,
      username: username || '',
      firstName: firstName || '',
      title: title || '',
      description: description || '',
      content: content || {},
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
    });

    // Notify all admins
    const bot = req.app.get('bot');
    const adminIds = config.ADMIN_IDS.length > 0 ? config.ADMIN_IDS : [config.ADMIN_ID];
    if (bot) {
      const inlineKeyboard = [
        [
          { text: '✅ 通过', callback_data: `approve_${report.id}` },
          { text: '❌ 拒绝', callback_data: `reject_${report.id}` },
          { text: '🔎 补充材料', callback_data: `need_info_${report.id}` },
        ],
      ];
      const msg =
        `📬 *新报告待审核*\n\n` +
        `报告编号：No.${report.reportNumber}\n` +
        `提交人：${firstName || ''} @${username || userId}\n` +
        `标题：${title || '无标题'}\n` +
        `标签：${report.tags.map((t) => `#${t}`).join(' ') || '无'}\n\n` +
        `内容：${description || JSON.stringify(content).slice(0, 200)}\n\n` +
        `请在此处或管理后台审核此报告。`;
      for (const adminId of adminIds) {
        await bot.telegram.sendMessage(String(adminId), msg, {
          parse_mode: 'Markdown',
          reply_markup: { inline_keyboard: inlineKeyboard },
        }).catch((e) => console.error(`Failed to notify admin ${adminId}:`, e.message));
      }
    }

    // Notify user: pending
    const admin = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
    const pendingMsg = admin?.reviewFeedback?.pending || '⏳ 你的报告已提交，等待管理员审核。';
    if (bot && userId) {
      await bot.telegram.sendMessage(String(userId), pendingMsg).catch(() => {});
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Get all reports (admin)
 */
async function getReports(req, res) {
  try {
    const { status, page = 1, limit = 20 } = req.query;
    const validStatuses = ['pending', 'approved', 'rejected', 'need_more_info'];
    const where = (status && validStatuses.includes(status)) ? { status } : {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const reports = await Report.findAll({
      where,
      order: [['createdAt', 'DESC']],
      offset: (pageNum - 1) * limitNum,
      limit: limitNum,
    });
    const total = await Report.count({ where });
    res.json({ success: true, data: reports, total, page: pageNum, limit: limitNum });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Review a report (approve / reject / need_more_info)
 * Uses atomic conditional update to prevent duplicate/concurrent reviews.
 * State machine: approve/reject only allowed from 'pending'.
 */
async function reviewReport(req, res) {
  try {
    const { id } = req.params;
    const { status, reviewNote, needMoreInfoNote } = req.body;

    const validStatuses = ['approved', 'rejected', 'need_more_info'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ success: false, message: '无效状态' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, message: '无效的报告 ID' });
    }

    const safeReviewNote = typeof reviewNote === 'string' ? reviewNote.slice(0, 500) : '';
    const safeNeedMoreInfoNote = typeof needMoreInfoNote === 'string' ? needMoreInfoNote.slice(0, 1000) : '';

    const updateFields = {
      status,
      reviewNote: safeReviewNote,
      reviewedAt: new Date(),
      reviewedBy: req.user?.userId || config.ADMIN_ID,
    };
    if (status === 'need_more_info') {
      updateFields.needMoreInfoNote = safeNeedMoreInfoNote;
    }

    // Atomic conditional update: only proceed if status is currently 'pending'
    const [affectedRows] = await Report.update(updateFields, {
      where: { id, status: 'pending' },
    });

    if (affectedRows === 0) {
      const report = await Report.findByPk(id);
      if (!report) return res.status(404).json({ success: false, message: '报告不存在' });

      if (report.status === 'need_more_info') {
        return res.status(409).json({
          success: false,
          message: '该报告正在等待用户补充材料，不可直接通过/拒绝，请等待用户重新提交后再审核。',
        });
      }
      return res.status(409).json({
        success: false,
        message: `该报告已由其他管理员处理（当前状态：${report.status}），无需重复操作。`,
      });
    }

    const report = await Report.findByPk(id);
    const bot = req.app.get('bot');
    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });

    if (status === 'approved') {
      // Push text-only to all configured publish channels
      const publishChats = await getPublishChats(adminConfig);
      const frontendUrl = config.FRONTEND_URL || config.API_URL;
      const reportUrl = config.joinUrl(frontendUrl, `report/${report.id}`);

      const pushText =
        `📋 *报告推送* No.${report.reportNumber}\n\n` +
        `👤 @${report.username || '匿名'}\n` +
        `📌 ${report.title || '无标题'}\n\n` +
        `${report.description || ''}\n\n` +
        (report.tags.length > 0 ? `🏷 ${report.tags.map((t) => `#${t}`).join(' ')}\n\n` : '') +
        (config.isValidPublicUrl(reportUrl) ? `🔗 [查看报告详情](${reportUrl})` : '');

      const channelMessages = [];
      if (bot) {
        for (const chatId of publishChats) {
          try {
            const msg = await bot.telegram.sendMessage(chatId, pushText, {
              parse_mode: 'Markdown',
              disable_web_page_preview: true,
            });
            const url = buildChannelMessageUrl(chatId, msg.message_id);
            channelMessages.push({ chatId, messageId: msg.message_id, url });
          } catch (e) {
            console.error(`Failed to push to channel ${chatId}:`, e.message);
          }
        }
      }

      if (channelMessages.length > 0) {
        await report.update({
          channelMessages,
          channelMessageId: channelMessages[0].messageId || null,
        });
      }

      // Notify user
      const approvedMsg = adminConfig?.reviewFeedback?.approved || '✅ 你的报告已通过审核，已推送到频道。';
      const linkText = channelMessages.length > 0 && channelMessages[0].url
        ? `\n\n🔗 ${channelMessages[0].url}` : '';
      if (bot && report.userId) {
        await bot.telegram.sendMessage(String(report.userId), approvedMsg + linkText).catch(() => {});
      }
    } else if (status === 'rejected') {
      const rejectedMsg = (adminConfig?.reviewFeedback?.rejected || '❌ 你的报告未通过审核，请修改后重新提交。') +
        (safeReviewNote ? `\n\n管理员备注：${safeReviewNote}` : '');
      if (bot && report.userId) {
        await bot.telegram.sendMessage(String(report.userId), rejectedMsg).catch(() => {});
      }
    } else if (status === 'need_more_info') {
      const baseMsg = adminConfig?.reviewFeedback?.needMoreInfo
        || '🔎 管理员需要更多信息才能完成审核，请补充材料后重新提交。';
      const noteText = safeNeedMoreInfoNote ? `\n\n📋 补充要求：${safeNeedMoreInfoNote}` : '';
      if (bot && report.userId) {
        await bot.telegram.sendMessage(String(report.userId), baseMsg + noteText, {
          reply_markup: {
            inline_keyboard: [[
              { text: '🔄 补充完成，重新提交', callback_data: `resubmit_${report.id}` },
            ]],
          },
        }).catch(() => {});
      }
    }

    // Fetch the updated record
    const updatedReport = await Report.findByPk(id);
    res.json({ success: true, data: updatedReport });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Search reports (public API for Mini App)
 * Supports keyword full-text search, @username, #tag
 */
async function searchReports(req, res) {
  try {
    const { q, type } = req.query;
    if (!q || typeof q !== 'string') return res.json({ success: true, data: [] });

    // Limit query length to prevent abuse
    const safeQ = q.slice(0, 100);
    const safeUsername = escapeLike(safeQ.replace(/^@/, ''));
    const safeTag = escapeLike(safeQ.replace(/^#/, ''));
    const safeText = escapeLike(safeQ);

    let where;
    if (type === 'username') {
      where = {
        status: 'approved',
        username: { [Op.iLike]: `%${safeUsername}%` },
      };
    } else if (type === 'tag') {
      where = {
        status: 'approved',
        [Op.and]: sequelize.where(
          sequelize.fn('array_to_string', sequelize.col('tags'), ','),
          { [Op.iLike]: `%${safeTag}%` }
        ),
      };
    } else {
      // Full-text / keyword search
      where = {
        status: 'approved',
        [Op.or]: [
          { username: { [Op.iLike]: `%${safeUsername}%` } },
          sequelize.where(
            sequelize.fn('array_to_string', sequelize.col('tags'), ','),
            { [Op.iLike]: `%${safeTag}%` }
          ),
          { title: { [Op.iLike]: `%${safeText}%` } },
          { description: { [Op.iLike]: `%${safeText}%` } },
        ],
      };
    }

    const reports = await Report.findAll({
      where,
      order: [['createdAt', 'DESC']],
      limit: 20,
    });
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { submitReport, getReports, reviewReport, searchReports };
