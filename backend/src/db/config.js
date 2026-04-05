require('dotenv').config();

const url =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/telegram_report_bot';

module.exports = {
  development: {
    url,
    dialect: 'postgres',
    logging: false,
  },
  test: {
    url,
    dialect: 'postgres',
    logging: false,
  },
  production: {
    url,
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
      ssl: { require: true, rejectUnauthorized: false },
    },
  },
};
