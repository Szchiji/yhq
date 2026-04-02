const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const Report = require('../../models/Report');
const Admin = require('../../models/Admin');
const config = require('../../config');
const { escapeLike } = require('../../utils/sanitize');

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

    // Notify admin
    const bot = req.app.get('bot');
    if (bot) {
      await bot.telegram.sendMessage(
        config.ADMIN_ID,
        `📬 *新报告待审核*\n\n` +
        `报告编号：No.${report.reportNumber}\n` +
        `提交人：${firstName || ''} @${username || userId}\n` +
        `标题：${title || '无标题'}\n` +
        `标签：${report.tags.map((t) => `#${t}`).join(' ') || '无'}\n\n` +
        `内容：${description || JSON.stringify(content).slice(0, 200)}\n\n` +
        `请在管理后台审核此报告。`,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '✅ 通过', callback_data: `approve_${report.id}` },
                { text: '❌ 拒绝', callback_data: `reject_${report.id}` },
              ],
            ],
          },
        }
      ).catch((e) => console.error('Failed to notify admin:', e.message));
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
    const validStatuses = ['pending', 'approved', 'rejected'];
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
 * Review a report (approve/reject)
 */
async function reviewReport(req, res) {
  try {
    const { id } = req.params;
    const { status, reviewNote } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ success: false, message: '无效状态' });
    }

    // Validate UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(id)) {
      return res.status(400).json({ success: false, message: '无效的报告 ID' });
    }

    const safeReviewNote = typeof reviewNote === 'string' ? reviewNote.slice(0, 500) : '';

    const report = await Report.findByPk(id);
    if (!report) {
      return res.status(404).json({ success: false, message: '报告不存在' });
    }
    await report.update({
      status,
      reviewNote: safeReviewNote,
      reviewedAt: new Date(),
      reviewedBy: config.ADMIN_ID,
    });

    const bot = req.app.get('bot');
    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });

    if (status === 'approved') {
      // Push to channel
      if (bot && adminConfig?.pushChannelId) {
        try {
          const channelMsg = await bot.telegram.sendMessage(
            adminConfig.pushChannelId,
            `📋 *报告推送* No.${report.reportNumber}\n\n` +
            `👤 @${report.username || '匿名'}\n` +
            `📌 ${report.title || '无标题'}\n\n` +
            `${report.description || ''}\n\n` +
            (report.tags.length > 0 ? `🏷 ${report.tags.map((t) => `#${t}`).join(' ')}` : ''),
            { parse_mode: 'Markdown' }
          );
          await report.update({ channelMessageId: channelMsg.message_id });
        } catch (e) {
          console.error('Failed to push to channel:', e.message);
        }
      }
      // Notify user
      const approvedMsg = adminConfig?.reviewFeedback?.approved || '✅ 你的报告已通过审核，已推送到频道。';
      if (bot && report.userId) {
        await bot.telegram.sendMessage(String(report.userId), approvedMsg).catch(() => {});
      }
    } else {
      // Notify user of rejection
      const rejectedMsg = (adminConfig?.reviewFeedback?.rejected || '❌ 你的报告未通过审核，请修改后重新提交。') +
        (reviewNote ? `\n\n管理员备注：${reviewNote}` : '');
      if (bot && report.userId) {
        await bot.telegram.sendMessage(String(report.userId), rejectedMsg).catch(() => {});
      }
    }

    res.json({ success: true, data: report });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Search reports (public API for Mini App)
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
        [Op.and]: [
          sequelize.where(
            sequelize.fn('array_to_string', sequelize.col('tags'), ','),
            { [Op.iLike]: `%${safeTag}%` }
          ),
        ],
      };
    } else {
      where = {
        status: 'approved',
        [Op.or]: [
          { username: { [Op.iLike]: `%${safeUsername}%` } },
          sequelize.where(
            sequelize.fn('array_to_string', sequelize.col('tags'), ','),
            { [Op.iLike]: `%${safeTag}%` }
          ),
          { title: { [Op.iLike]: `%${safeText}%` } },
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
