const express = require('express');
const cors = require('cors');
const path = require('path');
const rateLimit = require('express-rate-limit');
const config = require('../config');
const routes = require('./routes');

// Rate limiters
const generalLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '请求过于频繁，请稍后再试' },
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: '认证请求过于频繁，请稍后再试' },
});

/**
 * @param {import('telegraf').Telegraf} bot
 * @param {{ webhookPath?: string }} [options]
 */
function createApp(bot, options = {}) {
  const app = express();

  // Store bot instance for use in controllers
  app.set('bot', bot);

  // Trust reverse proxy (e.g. Railway) so express-rate-limit can read real client IPs
  app.set('trust proxy', 1);

  // CORS: restrict to configured origins
  const allowedOrigins = [
    config.FRONTEND_URL,
    config.API_URL,
    config.WEBHOOK_URL,
  ].filter(Boolean);

  app.use(cors({
    origin: (origin, callback) => {
      // Allow requests with no origin (e.g., mobile apps, curl) or matching origins
      if (!origin || allowedOrigins.some((o) => origin.startsWith(o))) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Apply general rate limit to all API routes
  app.use('/api', generalLimiter);

  // Telegram webhook endpoint (no rate limit needed - Telegram handles this)
  if (options.webhookPath && bot) {
    app.use(bot.webhookCallback(options.webhookPath));
  }

  // API routes (auth endpoints get stricter limit)
  app.use('/api/auth', authLimiter);
  app.use('/api', routes);

  // Serve frontend static files in production
  const frontendDist = path.join(__dirname, '../../frontend-dist');
  const fs = require('fs');
  if (fs.existsSync(frontendDist)) {
    const staticLimiter = rateLimit({
      windowMs: 15 * 60 * 1000,
      max: 500,
      standardHeaders: true,
      legacyHeaders: false,
    });
    app.use(staticLimiter);
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  return app;
}

module.exports = createApp;
