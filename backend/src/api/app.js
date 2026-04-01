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

function createApp(bot) {
  const app = express();

  // Store bot instance for use in controllers
  app.set('bot', bot);

  // CORS: restrict to configured origins
  const allowedOrigins = [
    config.FRONTEND_URL,
    config.API_URL,
    config.WEBHOOK_DOMAIN,
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
  if (config.WEBHOOK_DOMAIN && bot) {
    const webhookPath = `/webhook/${config.BOT_TOKEN}`;
    app.use(bot.webhookCallback(webhookPath));
  }

  // API routes (auth endpoints get stricter limit)
  app.use('/api/auth', authLimiter);
  app.use('/api', routes);

  // Serve frontend static files in production
  const frontendDist = path.join(__dirname, '../../frontend-dist');
  const fs = require('fs');
  if (fs.existsSync(frontendDist)) {
    app.use(express.static(frontendDist));
    app.get('*', (req, res) => {
      res.sendFile(path.join(frontendDist, 'index.html'));
    });
  }

  return app;
}

module.exports = createApp;
