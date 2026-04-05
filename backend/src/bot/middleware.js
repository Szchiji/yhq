const User = require('../models/User');
const { getAdminConfig, buildSubscribeKeyboard } = require('./keyboards');
const config = require('../config');

/**
 * Check if a user ID is an admin.
 */
function isAdmin(userId) {
  if (!userId) return false;
  if (config.ADMIN_IDS && config.ADMIN_IDS.length > 0) {
    return config.ADMIN_IDS.includes(userId);
  }
  return userId === config.ADMIN_ID;
}

/**
 * Save or update user record in DB
 */
async function upsertUser(telegramUser) {
  await User.upsert({
    userId: telegramUser.id,
    username: telegramUser.username || '',
    firstName: telegramUser.first_name || '',
    lastName: telegramUser.last_name || '',
  });
}

/**
 * Get the list of required subscription chats.
 * Priority: REQUIRED_CHATS env var → admin.channelId DB config.
 */
async function getRequiredChats() {
  if (config.REQUIRED_CHATS && config.REQUIRED_CHATS.length > 0) {
    return config.REQUIRED_CHATS;
  }
  const admin = await getAdminConfig();
  return admin.channelId ? [admin.channelId] : [];
}

/**
 * Check if a user is subscribed to ALL required channels/groups.
 * Returns true if no channels configured or user is an admin.
 */
async function checkSubscription(ctx, bot) {
  if (!ctx.from) return true;
  const userId = ctx.from.id;

  if (isAdmin(userId)) return true;

  const requiredChats = await getRequiredChats();
  if (requiredChats.length === 0) return true;

  for (const chatId of requiredChats) {
    try {
      const member = await bot.telegram.getChatMember(chatId, userId);
      const validStatuses = ['member', 'administrator', 'creator'];
      if (!validStatuses.includes(member.status)) {
        return false;
      }
    } catch {
      // If we can't check, treat as not subscribed to be safe
      return false;
    }
  }
  return true;
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

    const requiredChats = await getRequiredChats();
    await ctx.reply(
      '⚠️ 请先订阅我们的频道才能使用此机器人！\n\n订阅后点击"我已加入，重新检测"按钮继续。',
      buildSubscribeKeyboard(requiredChats)
    );
  };
}

module.exports = { upsertUser, checkSubscription, subscriptionMiddleware, isAdmin, getRequiredChats };
