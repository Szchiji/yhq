const { Markup } = require('telegraf');
const Admin = require('../models/Admin');
const config = require('../config');

/**
 * Get current admin config (creates default if none exists)
 */
async function getAdminConfig() {
  const [admin] = await Admin.findOrCreate({
    where: { adminId: config.ADMIN_ID },
    defaults: { adminId: config.ADMIN_ID },
  });
  return admin;
}

/**
 * Build the main reply keyboard from admin config
 */
async function buildMainKeyboard() {
  const admin = await getAdminConfig();
  const buttons = admin.keyboards.map((k) => [k.text]);
  return Markup.keyboard(buttons).resize();
}

/**
 * Build inline keyboard for /start message
 */
async function buildStartInlineKeyboard() {
  const admin = await getAdminConfig();
  if (!admin.startContent.buttons || admin.startContent.buttons.length === 0) {
    return Markup.inlineKeyboard([]);
  }
  const rows = admin.startContent.buttons.map((btn) => {
    if (btn.url) {
      return Markup.button.url(btn.text, btn.url);
    }
    return Markup.button.callback(btn.text, btn.action || 'noop');
  });
  return Markup.inlineKeyboard(rows);
}

/**
 * Build a t.me link for a given Telegram chat + message.
 * Works for both public channels (@username) and private channels (-100xxx).
 */
function buildChannelMessageUrl(chatId, messageId) {
  if (!chatId || !messageId) return null;
  const str = String(chatId);
  if (str.startsWith('@')) {
    // Public channel: https://t.me/channelname/msgid
    return `https://t.me/${str.slice(1)}/${messageId}`;
  }
  // Private channel: -100xxxxxxxxxx → strip -100 prefix
  const numericId = str.replace(/^-100/, '');
  return `https://t.me/c/${numericId}/${messageId}`;
}

/**
 * Build subscription check keyboard for one or more required chats.
 * @param {string|string[]} requiredChats - single chat ID/username or array
 */
function buildSubscribeKeyboard(requiredChats) {
  const chats = Array.isArray(requiredChats) ? requiredChats : [requiredChats].filter(Boolean);
  const subscribeButtons = chats.map((chatId) => {
    const link = chatId.startsWith('@')
      ? `https://t.me/${chatId.slice(1)}`
      : `https://t.me/c/${String(chatId).replace('-100', '')}`;
    const label = chatId.startsWith('@') ? chatId : `频道 ${chatId}`;
    return [Markup.button.url(`📢 订阅 ${label}`, link)];
  });
  subscribeButtons.push([Markup.button.callback('✅ 我已加入，重新检测', 'check_subscription')]);
  return Markup.inlineKeyboard(subscribeButtons);
}

module.exports = {
  getAdminConfig,
  buildMainKeyboard,
  buildStartInlineKeyboard,
  buildSubscribeKeyboard,
  buildChannelMessageUrl,
};
