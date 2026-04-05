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
  PORT: parseInt(process.env.PORT, 10) || 8080,
  NODE_ENV: process.env.NODE_ENV || 'development',
  // Bot mode: 'polling' | 'webhook' | 'auto' (default)
  // auto → webhook when WEBHOOK_URL is set and NODE_ENV=production, otherwise polling
  BOT_MODE: process.env.BOT_MODE || 'auto',
  // WEBHOOK_URL: public base URL (e.g. https://xxx.up.railway.app)
  // Falls back to WEBHOOK_DOMAIN for backward compatibility
  WEBHOOK_URL: process.env.WEBHOOK_URL || process.env.WEBHOOK_DOMAIN || '',
  // WEBHOOK_PATH: the path for the webhook endpoint (default: /webhook)
  WEBHOOK_PATH: process.env.WEBHOOK_PATH || '/webhook',
  // Keep WEBHOOK_DOMAIN as alias for backward compatibility
  get WEBHOOK_DOMAIN() {
    return this.WEBHOOK_URL;
  },
  isValidPublicUrl,
};
