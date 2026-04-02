const { Op } = require('sequelize');
const { sequelize } = require('../../db');
const Report = require('../../models/Report');
const { getAdminConfig } = require('../keyboards');
const { escapeLike } = require('../../utils/sanitize');

/**
 * Handle query_report keyboard action
 */
async function handleQueryReport(ctx) {
  await ctx.reply(
    '🔍 *查阅报告*\n\n请发送查询内容：\n\n' +
    '• 发送 `@用户名` 查询该用户的报告\n' +
    '• 发送 `#标签` 查询相关标签的报告\n\n' +
    '例如：`@zhangsan` 或 `#项目报告`',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Search reports by username (@mention)
 */
async function searchByUsername(ctx, username) {
  const cleanUsername = escapeLike(username.replace(/^@/, '').slice(0, 64));

  const reports = await Report.findAll({
    where: {
      username: { [Op.iLike]: cleanUsername },
      status: 'approved',
    },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  if (reports.length === 0) {
    return ctx.reply(`📭 未找到用户 @${cleanUsername} 的报告。`);
  }

  const text = formatReportList(reports, `@${cleanUsername} 的报告`);
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
}

/**
 * Search reports by tag (#tag)
 */
async function searchByTag(ctx, tag) {
  const cleanTag = escapeLike(tag.replace(/^#/, '').slice(0, 64));

  const reports = await Report.findAll({
    where: {
      status: 'approved',
      [Op.and]: [
        sequelize.where(
          sequelize.fn('array_to_string', sequelize.col('tags'), ','),
          { [Op.iLike]: `%${cleanTag}%` }
        ),
      ],
    },
    order: [['createdAt', 'DESC']],
    limit: 10,
  });

  if (reports.length === 0) {
    return ctx.reply(`📭 未找到标签 #${cleanTag} 的报告。`);
  }

  const text = formatReportList(reports, `#${cleanTag} 的报告`);
  await ctx.reply(text, { parse_mode: 'Markdown', disable_web_page_preview: true });
}

/**
 * Format a list of reports into a readable message
 */
function formatReportList(reports, title) {
  let text = `📋 *${title}*\n共找到 ${reports.length} 份报告\n\n`;
  reports.forEach((r, i) => {
    const date = r.createdAt.toLocaleDateString('zh-CN');
    text += `*${i + 1}. ${r.title || '无标题'}* (No.${r.reportNumber})\n`;
    text += `👤 @${r.username || '匿名'} | 📅 ${date}\n`;
    if (r.tags && r.tags.length > 0) {
      text += `🏷 ${r.tags.map((t) => `#${t}`).join(' ')}\n`;
    }
    if (r.description) {
      const desc = r.description.length > 80 ? r.description.slice(0, 80) + '...' : r.description;
      text += `📝 ${desc}\n`;
    }
    text += '\n';
  });
  return text;
}

/**
 * Handle incoming text messages for search
 */
async function handleSearchMessage(ctx) {
  const text = ctx.message.text.trim();

  if (text.startsWith('@')) {
    return searchByUsername(ctx, text);
  }
  if (text.startsWith('#')) {
    return searchByTag(ctx, text);
  }
  return null;
}

/**
 * Handle write_report keyboard action
 */
async function handleWriteReport(ctx) {
  const admin = await getAdminConfig();
  const frontendUrl = process.env.FRONTEND_URL || process.env.API_URL;
  const reportUrl = `${frontendUrl}/report?userId=${ctx.from.id}`;

  const { Markup } = require('telegraf');
  await ctx.reply(
    '📝 *填写报告*\n\n点击下方按钮进入报告填写页面：',
    {
      parse_mode: 'Markdown',
      ...Markup.inlineKeyboard([
        [Markup.button.url('📝 填写报告', reportUrl)],
      ]),
    }
  );
}

/**
 * Handle contact_admin keyboard action
 */
async function handleContactAdmin(ctx) {
  const config = require('../../config');
  await ctx.reply(
    '📞 *联系管理员*\n\n如有问题请联系管理员。',
    { parse_mode: 'Markdown' }
  );
}

/**
 * Handle help keyboard action
 */
async function handleHelp(ctx) {
  await ctx.reply(
    '❓ *操作帮助*\n\n' +
    '• 📝 写报告 - 进入 Mini App 填写并提交报告\n' +
    '• 🔍 查阅报告 - 搜索已审核通过的报告\n' +
    '  - 发送 `@用户名` 按用户搜索\n' +
    '  - 发送 `#标签` 按标签搜索\n' +
    '• 📞 联系管理员 - 获取管理员联系方式\n\n' +
    '如有其他问题，请联系管理员。',
    { parse_mode: 'Markdown' }
  );
}

module.exports = {
  handleQueryReport,
  handleWriteReport,
  handleContactAdmin,
  handleHelp,
  handleSearchMessage,
  searchByUsername,
  searchByTag,
};
