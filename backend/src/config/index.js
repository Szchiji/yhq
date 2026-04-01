require('dotenv').config();

module.exports = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  ADMIN_ID: parseInt(process.env.ADMIN_ID, 10),
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/telegram-report-bot',
  API_URL: process.env.API_URL || 'http://localhost:3000',
  FRONTEND_URL: process.env.FRONTEND_URL || 'http://localhost:5173',
  JWT_SECRET: process.env.JWT_SECRET || 'change_this_secret',
  PORT: parseInt(process.env.PORT, 10) || 3000,
  NODE_ENV: process.env.NODE_ENV || 'development',
  WEBHOOK_DOMAIN: process.env.WEBHOOK_DOMAIN || '',
};
