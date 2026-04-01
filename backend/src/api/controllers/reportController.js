const Report = require('../../models/Report');
const Admin = require('../../models/Admin');
const config = require('../../config');
const { escapeRegex, sanitizeMongoQuery } = require('../../utils/sanitize');

/**
 * Submit a new report (from Mini App)
 */
async function submitReport(req, res) {
  try {
    const body = sanitizeMongoQuery(req.body);
    const { userId, username, firstName, title, description, content, tags } = body;
    const report = new Report({
      userId,
      username: username || '',
      firstName: firstName || '',
      title: title || '',
      description: description || '',
      content: content || {},
      tags: Array.isArray(tags) ? tags : (tags ? [tags] : []),
    });
    await report.save();

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
                { text: '✅ 通过', callback_data: `approve_${report._id}` },
                { text: '❌ 拒绝', callback_data: `reject_${report._id}` },
              ],
            ],
          },
        }
      ).catch((e) => console.error('Failed to notify admin:', e.message));
    }

    // Notify user: pending
    const admin = await Admin.findOne({ adminId: config.ADMIN_ID });
    const pendingMsg = admin?.reviewFeedback?.pending || '⏳ 你的报告已提交，等待管理员审核。';
    if (bot && userId) {
      await bot.telegram.sendMessage(userId, pendingMsg).catch(() => {});
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
    const query = (status && validStatuses.includes(status)) ? { status } : {};
    const pageNum = Math.max(1, parseInt(page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(limit) || 20));
    const reports = await Report.find(query)
      .sort({ createdAt: -1 })
      .skip((pageNum - 1) * limitNum)
      .limit(limitNum);
    const total = await Report.countDocuments(query);
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

    // Validate that id is a valid MongoDB ObjectId format
    if (!/^[a-f\d]{24}$/i.test(id)) {
      return res.status(400).json({ success: false, message: '无效的报告 ID' });
    }

    const safeReviewNote = typeof reviewNote === 'string' ? reviewNote.slice(0, 500) : '';

    const report = await Report.findByIdAndUpdate(
      id,
      {
        status,
        reviewNote: safeReviewNote,
        reviewedAt: new Date(),
        reviewedBy: config.ADMIN_ID,
      },
      { new: true }
    );

    if (!report) {
      return res.status(404).json({ success: false, message: '报告不存在' });
    }

    const bot = req.app.get('bot');
    const adminConfig = await Admin.findOne({ adminId: config.ADMIN_ID });

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
          report.channelMessageId = channelMsg.message_id;
          await report.save();
        } catch (e) {
          console.error('Failed to push to channel:', e.message);
        }
      }
      // Notify user
      const approvedMsg = adminConfig?.reviewFeedback?.approved || '✅ 你的报告已通过审核，已推送到频道。';
      if (bot && report.userId) {
        await bot.telegram.sendMessage(report.userId, approvedMsg).catch(() => {});
      }
    } else {
      // Notify user of rejection
      const rejectedMsg = (adminConfig?.reviewFeedback?.rejected || '❌ 你的报告未通过审核，请修改后重新提交。') +
        (reviewNote ? `\n\n管理员备注：${reviewNote}` : '');
      if (bot && report.userId) {
        await bot.telegram.sendMessage(report.userId, rejectedMsg).catch(() => {});
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
    const safeUsername = escapeRegex(safeQ.replace(/^@/, ''));
    const safeTag = escapeRegex(safeQ.replace(/^#/, ''));
    const safeText = escapeRegex(safeQ);

    let query = { status: 'approved' };
    if (type === 'username') {
      query.username = { $regex: new RegExp(safeUsername, 'i') };
    } else if (type === 'tag') {
      query.tags = { $regex: new RegExp(safeTag, 'i') };
    } else {
      query.$or = [
        { username: { $regex: new RegExp(safeUsername, 'i') } },
        { tags: { $regex: new RegExp(safeTag, 'i') } },
        { title: { $regex: new RegExp(safeText, 'i') } },
      ];
    }

    const reports = await Report.find(query).sort({ createdAt: -1 }).limit(20);
    res.json({ success: true, data: reports });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { submitReport, getReports, reviewReport, searchReports };
