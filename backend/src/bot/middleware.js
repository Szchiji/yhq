const User = require('../models/User');
const { getAdminConfig, buildSubscribeKeyboard } = require('./keyboards');

/**
 * Save or update user record in DB
 */
async function upsertUser(telegramUser) {
  await User.findOneAndUpdate(
    { userId: telegramUser.id },
    {
      userId: telegramUser.id,
      username: telegramUser.username || '',
      firstName: telegramUser.first_name || '',
      lastName: telegramUser.last_name || '',
    },
    { upsert: true, new: true }
  );
}

/**
 * Check if a user is subscribed to the required channel.
 * Returns true if no channel configured or user is subscribed/admin.
 */
async function checkSubscription(ctx, bot) {
  const admin = await getAdminConfig();
  if (!admin.channelId) return true;

  const userId = ctx.from.id;
  const config = require('../config');
  if (userId === config.ADMIN_ID) return true;

  try {
    const member = await bot.telegram.getChatMember(admin.channelId, userId);
    const validStatuses = ['member', 'administrator', 'creator'];
    return validStatuses.includes(member.status);
  } catch {
    return false;
  }
}

/**
 * Middleware: ensure user is subscribed before processing
 */
function subscriptionMiddleware(bot) {
  return async (ctx, next) => {
    if (!ctx.from) return next();

    // Save/update user
    await upsertUser(ctx.from).catch(() => {});

    const isSubscribed = await checkSubscription(ctx, bot);
    if (isSubscribed) return next();

    const admin = await getAdminConfig();
    await ctx.reply(
      '⚠️ 请先订阅我们的频道才能使用此机器人！\n\n订阅后点击"我已订阅"按钮继续。',
      buildSubscribeKeyboard(admin.channelId)
    );
  };
}

module.exports = { upsertUser, checkSubscription, subscriptionMiddleware };
