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
 * Build subscription check keyboard
 */
function buildSubscribeKeyboard(channelId) {
  const channelLink = channelId.startsWith('@')
    ? `https://t.me/${channelId.slice(1)}`
    : `https://t.me/c/${channelId.replace('-100', '')}`;
  return Markup.inlineKeyboard([
    [Markup.button.url('📢 点击订阅频道', channelLink)],
    [Markup.button.callback('✅ 我已订阅', 'check_subscription')],
  ]);
}

module.exports = { getAdminConfig, buildMainKeyboard, buildStartInlineKeyboard, buildSubscribeKeyboard };
