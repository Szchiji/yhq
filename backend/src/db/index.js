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

    // Create tables if they don't exist (safe for production)
    await sequelize.sync();
    console.log('Database tables synchronized');
  } catch (err) {
    console.error('PostgreSQL connection error:', err.message);
    process.exit(1);
  }
}

module.exports = { sequelize, connectDB };
