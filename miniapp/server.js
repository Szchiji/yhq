const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.MINIAPP_PORT || 3000;
const API_BASE = process.env.API_BASE || 'http://localhost:8080';

// Simple in-memory rate limiter
const requestCounts = new Map();
const RATE_LIMIT = 120; // requests per minute per IP
const WINDOW_MS = 60 * 1000;

function rateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = requestCounts.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    entry.count++;
    requestCounts.set(ip, entry);
    if (entry.count > RATE_LIMIT) {
        return res.status(429).send('Too Many Requests');
    }
    next();
}

// Simple in-memory rate limiter for the config endpoint
const configRequestCounts = new Map();
const CONFIG_RATE_LIMIT = 30; // requests per minute
const CONFIG_WINDOW_MS = 60 * 1000;

function configRateLimit(req, res, next) {
    const ip = req.ip || req.connection.remoteAddress || 'unknown';
    const now = Date.now();
    const entry = configRequestCounts.get(ip) || { count: 0, windowStart: now };
    if (now - entry.windowStart > CONFIG_WINDOW_MS) {
        entry.count = 0;
        entry.windowStart = now;
    }
    entry.count++;
    configRequestCounts.set(ip, entry);
    if (entry.count > CONFIG_RATE_LIMIT) {
        return res.status(429).send('Too Many Requests');
    }
    next();
}

// Apply rate limiting globally to all routes
app.use(rateLimit);

// Static file service
app.use(express.static(path.join(__dirname, 'public')));

// Inject API_BASE into frontend (rate-limited)
app.get('/config.js', configRateLimit, (req, res) => {
    res.type('application/javascript');
    res.send(`window.API_BASE = '${API_BASE}';`);
});

// SPA fallback
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
    console.log(`miniapp 服务器已启动：http://localhost:${PORT}`);
});

module.exports = app;
