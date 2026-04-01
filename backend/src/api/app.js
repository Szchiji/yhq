const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('../config');
const routes = require('./routes');

function createApp(bot) {
  const app = express();

  // Store bot instance for use in controllers
  app.set('bot', bot);

  // Middleware
  app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true }));

  // Telegram webhook endpoint
  if (config.WEBHOOK_DOMAIN && bot) {
    const webhookPath = `/webhook/${config.BOT_TOKEN}`;
    app.use(bot.webhookCallback(webhookPath));
  }

  // API routes
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
