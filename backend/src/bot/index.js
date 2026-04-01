const { Telegraf } = require('telegraf');
const config = require('../config');
const { subscriptionMiddleware } = require('./middleware');
const { handleStart, handleCheckSubscription, handleAdminPanel } = require('./handlers/start');
const {
  handleQueryReport,
  handleWriteReport,
  handleContactAdmin,
  handleHelp,
  handleSearchMessage,
} = require('./handlers/report');
const { getAdminConfig } = require('./keyboards');

function createBot() {
  const bot = new Telegraf(config.BOT_TOKEN);

  // Apply subscription middleware (skip for commands)
  bot.use(async (ctx, next) => {
    // Always allow admin
    if (ctx.from && ctx.from.id === config.ADMIN_ID) return next();
    // Allow /start and subscription callback without check
    if (ctx.message && ctx.message.text === '/start') return next();
    if (ctx.callbackQuery && ctx.callbackQuery.data === 'check_subscription') return next();
    // Apply subscription check
    return subscriptionMiddleware(bot)(ctx, next);
  });

  // Commands
  bot.command('start', (ctx) => handleStart(ctx, bot));
  bot.command('admin', (ctx) => handleAdminPanel(ctx));

  // Callback queries
  bot.action('check_subscription', (ctx) => handleCheckSubscription(ctx, bot));
  bot.action('noop', (ctx) => ctx.answerCbQuery());

  // Handle keyboard button presses by matching text
  bot.on('text', async (ctx) => {
    const text = ctx.message.text.trim();

    // Handle search queries
    if (text.startsWith('@') || text.startsWith('#')) {
      return handleSearchMessage(ctx);
    }

    // Match keyboard button actions
    const admin = await getAdminConfig();
    const keyboard = admin.keyboards.find((k) => k.text === text);

    if (keyboard) {
      switch (keyboard.action) {
        case 'write_report':
          return handleWriteReport(ctx);
        case 'query_report':
          return handleQueryReport(ctx);
        case 'contact_admin':
          return handleContactAdmin(ctx);
        case 'help':
          return handleHelp(ctx);
        default:
          return ctx.reply(`你点击了：${text}`);
      }
    }

    // Default: try search
    if (text.startsWith('@') || text.startsWith('#')) {
      return handleSearchMessage(ctx);
    }
  });

  // Error handler
  bot.catch((err, ctx) => {
    console.error(`Bot error for update ${ctx.updateType}:`, err.message);
  });

  return bot;
}

module.exports = createBot;
