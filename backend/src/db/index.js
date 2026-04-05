const { Sequelize } = require('sequelize');
const config = require('../config');

const sequelize = new Sequelize(config.DATABASE_URL, {
  dialect: 'postgres',
  logging: false,
  dialectOptions: config.NODE_ENV === 'production'
    ? { ssl: { require: true, rejectUnauthorized: false } }
    : {},
});

async function connectDB() {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected successfully');

    // Ensure all models are registered before sync
    require('../models/User');
    require('../models/Report');
    require('../models/Admin');
    require('../models/ReportDraft');
    require('../models/AdminLoginOtp');

    // Enable pg_trgm for trigram-based full-text search (best-effort)
    try {
      await sequelize.query('CREATE EXTENSION IF NOT EXISTS pg_trgm;');
    } catch (e) {
      console.warn('Could not enable pg_trgm extension (non-fatal):', e.message);
    }

    // Create tables if they don't exist (safe for production)
    // alter:true is used to add new columns when the schema evolves;
    // in production this only ADDs columns, never removes them (Sequelize limitation).
    // For destructive changes, use explicit migrations.
    const alterSchema = config.NODE_ENV !== 'production' || process.env.DB_ALLOW_ALTER === 'true';
    await sequelize.sync({ alter: alterSchema });
    console.log('Database tables synchronized');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
