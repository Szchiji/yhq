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

/**
 * Parse a comma-separated string of chat IDs/usernames into an array.
 * Returns an empty array if the value is falsy.
 */
function parseChatList(value) {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Join a base URL and a path, normalising double slashes.
 */
function joinUrl(base, path) {
  const b = String(base || '').replace(/\/+$/, '');
  const p = String(path || '').replace(/^\/+/, '');
  return `${b}/${p}`;
}

// Parse admin IDs: ADMIN_IDS takes precedence, falls back to ADMIN_ID
const rawAdminIds = process.env.ADMIN_IDS || (process.env.ADMIN_ID ? process.env.ADMIN_ID : '');
const adminIds = rawAdminIds
  .split(',')
  .map((s) => parseInt(s.trim(), 10))
  .filter((n) => !isNaN(n));

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  // Legacy single admin ID (first in list for backward compatibility)
  ADMIN_ID: adminIds[0] || parseInt(process.env.ADMIN_ID, 10) || 0,
  // All admin IDs (supports multiple admins via ADMIN_IDS=id1,id2,...)
  ADMIN_IDS: adminIds,
  // Required subscription chats (comma-separated channel IDs or @usernames)
  // e.g. REQUIRED_CHATS=-100123456789,-100987654321
  REQUIRED_CHATS: parseChatList(process.env.REQUIRED_CHATS),
  // Publish channels to push approved reports (text only)
  // e.g. PUBLISH_CHATS=-100123456789,-100987654321
  PUBLISH_CHATS: parseChatList(process.env.PUBLISH_CHATS),
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
  joinUrl,
};
