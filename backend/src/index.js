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

  // Create bot (all callback handlers registered in bot/index.js)
  const bot = createBot();

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
