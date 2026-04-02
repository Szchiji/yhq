require('dotenv').config();

/**
 * Returns true only for absolute http/https URLs that are not localhost/127.x/::1.
 * Used to guard Telegram inline keyboard URL buttons, which require a publicly
 * reachable address.
 */
function isValidPublicUrl(url) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return false;
    const host = parsed.hostname.toLowerCase();
    if (host === 'localhost' || host.startsWith('127.') || host === '[::1]') return false;
    return true;
  } catch {
    return false;
  }
}

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID, 10),
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/telegram_report_bot',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'change_this_secret',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN || '',
  isValidPublicUrl,
};
