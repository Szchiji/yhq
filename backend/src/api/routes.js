const express = require('express');
const router = express.Router();
const { requireAdmin, requireAuth } = require('../utils/auth');
const { telegramAuth } = require('./controllers/authController');
const { getConfig, updateConfig } = require('./controllers/adminController');
const {
  submitReport,
  getReports,
  reviewReport,
  searchReports,
} = require('./controllers/reportController');

// Auth
router.post('/auth/telegram', telegramAuth);

// Admin routes (requires admin JWT)
router.get('/admin/config', requireAdmin, getConfig);
router.put('/admin/config', requireAdmin, updateConfig);
router.get('/admin/reports', requireAdmin, getReports);
router.put('/admin/reports/:id/review', requireAdmin, reviewReport);

// User routes (requires any valid JWT)
router.post('/reports', requireAuth, submitReport);
router.get('/reports/search', searchReports);

// Health check
router.get('/health', (req, res) => res.json({ status: 'ok' }));

module.exports = router;
