require('dotenv').config();
const { connectDB } = require('./db');
const createBot = require('./bot');
const createApp = require('./api/app');
const config = require('./config');

/**
 * Determine bot launch mode.
 * - 'webhook': WEBHOOK_URL is required; registers webhook with Telegram and
 *              processes updates via Express middleware.
 * - 'polling': Deletes any existing webhook, then starts long polling.
 * - 'auto' (default): webhook when WEBHOOK_URL is set AND NODE_ENV=production,
 *              otherwise polling.
 */
function resolveBotMode() {
  const { BOT_MODE, WEBHOOK_URL, NODE_ENV } = config;
  if (BOT_MODE === 'webhook') return 'webhook';
  if (BOT_MODE === 'polling') return 'polling';
  // auto
  return WEBHOOK_URL && NODE_ENV === 'production' ? 'webhook' : 'polling';
}

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

  // Determine bot mode
  const mode = resolveBotMode();
  const webhookPath = config.WEBHOOK_PATH;
  const webhookUrl = config.WEBHOOK_URL;

  // Create Express app – pass webhookPath only in webhook mode so the
  // bot.webhookCallback() middleware is mounted before any other routes
  const app = createApp(bot, mode === 'webhook' ? { webhookPath } : {});

  // Start HTTP server
  const server = app.listen(config.PORT, () => {
    console.log(`Server running on port ${config.PORT}`);
  });

  // Launch bot in the resolved mode
  if (mode === 'webhook') {
    if (!webhookUrl) {
      throw new Error('BOT_MODE=webhook requires WEBHOOK_URL to be set');
    }
    const fullWebhookUrl = `${webhookUrl}${webhookPath}`;
    // Register webhook with Telegram (drop pending updates to avoid stale messages
    // from previous polling sessions)
    await bot.telegram.setWebhook(fullWebhookUrl, { drop_pending_updates: true });
    console.log(`[BOT] Webhook mode | path: ${webhookPath} | url: ${fullWebhookUrl}`);
  } else {
    // Polling mode: clear any previously registered webhook first to avoid 409
    await bot.telegram.deleteWebhook({ drop_pending_updates: true });
    console.log('[BOT] Polling mode');
    await bot.launch();
    console.log('[BOT] Bot started in polling mode');
  }

  // Graceful shutdown
  async function shutdown(signal) {
    console.log(`[BOT] Received ${signal}, shutting down…`);
    // Force-exit after 10 s if graceful shutdown takes too long
    const forceExit = setTimeout(() => {
      console.error('[BOT] Forced exit after timeout');
      process.exit(1);
    }, 10000).unref();

    await bot.stop(signal);
    server.close((err) => {
      clearTimeout(forceExit);
      if (err) {
        console.error('[BOT] HTTP server close error:', err.message);
        process.exit(1);
      }
      console.log('[BOT] HTTP server closed');
      process.exit(0);
    });
  }

  process.once('SIGINT', async () => shutdown('SIGINT'));
  process.once('SIGTERM', async () => shutdown('SIGTERM'));
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
