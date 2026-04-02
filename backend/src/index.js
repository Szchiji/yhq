require('dotenv').config();
const { connectDB } = require('./db');
const createBot = require('./bot');
const createApp = require('./api/app');
const config = require('./config');

async function main() {
  // Connect to PostgreSQL
  await connectDB();

  // Create bot
  const bot = createBot();

  // Handle bot callback queries for report review (approve/reject from admin messages)
  bot.action(/^approve_(.+)$/, async (ctx) => {
    const reportId = ctx.match[1];
    const Report = require('./models/Report');
    const Admin = require('./models/Admin');
    const report = await Report.findByPk(reportId);
    if (!report) return ctx.answerCbQuery('报告不存在');
    await report.update({ status: 'approved', reviewedAt: new Date(), reviewedBy: config.ADMIN_ID });

    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });

    // Push to channel
    if (adminConfig?.pushChannelId) {
      try {
        await ctx.telegram.sendMessage(
          adminConfig.pushChannelId,
          `📋 *报告推送* No.${report.reportNumber}\n\n` +
          `👤 @${report.username || '匿名'}\n` +
          `📌 ${report.title || '无标题'}\n\n` +
          `${report.description || ''}\n\n` +
          (report.tags.length > 0 ? `🏷 ${report.tags.map((t) => `#${t}`).join(' ')}` : ''),
          { parse_mode: 'Markdown' }
        );
      } catch (e) {
        console.error('Failed to push to channel:', e.message);
      }
    }

    // Notify user
    const approvedMsg = adminConfig?.reviewFeedback?.approved || '✅ 你的报告已通过审核，已推送到频道。';
    await ctx.telegram.sendMessage(String(report.userId), approvedMsg).catch(() => {});

    await ctx.answerCbQuery('✅ 已通过审核');
    await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n✅ 已审核通过', { parse_mode: 'Markdown' }).catch(() => {});
  });

  bot.action(/^reject_(.+)$/, async (ctx) => {
    const reportId = ctx.match[1];
    const Report = require('./models/Report');
    const Admin = require('./models/Admin');
    const report = await Report.findByPk(reportId);
    if (!report) return ctx.answerCbQuery('报告不存在');
    await report.update({ status: 'rejected', reviewedAt: new Date(), reviewedBy: config.ADMIN_ID });

    const adminConfig = await Admin.findOne({ where: { adminId: config.ADMIN_ID } });
    const rejectedMsg = adminConfig?.reviewFeedback?.rejected || '❌ 你的报告未通过审核，请修改后重新提交。';
    await ctx.telegram.sendMessage(String(report.userId), rejectedMsg).catch(() => {});

    await ctx.answerCbQuery('❌ 已拒绝');
    await ctx.editMessageText(ctx.callbackQuery.message.text + '\n\n❌ 已拒绝', { parse_mode: 'Markdown' }).catch(() => {});
  });

  // Create Express app
  const app = createApp(bot);

  // Start server
  app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });

  // Start bot
  if (config.WEBHOOK_DOMAIN) {
    const webhookUrl = `${config.WEBHOOK_DOMAIN}/webhook/${config.BOT_TOKEN}`;
    await bot.telegram.setWebhook(webhookUrl);
    console.log(`Bot webhook set: ${webhookUrl}`);
  } else {
    await bot.launch();
    console.log('Bot started in polling mode');
  }

  // Graceful shutdown
  process.once('SIGINT', () => bot.stop('SIGINT'));
  process.once('SIGTERM', () => bot.stop('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
