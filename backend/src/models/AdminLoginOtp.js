const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

/**
 * AdminLoginOtp – one-time passcodes for browser-based admin login.
 *
 * Flow:
 *  1. Browser calls POST /api/auth/otp/request  → creates row, returns id + code
 *  2. Admin sends 6-digit code to bot in private chat
 *  3. Bot verifies admin identity + code, sets verifiedAt + verifiedBy
 *  4. Browser polls GET /api/auth/otp/status?otpId=...
 *     → once verifiedAt is set: issue JWT, set usedAt, return token
 */
const AdminLoginOtp = sequelize.define(
  'AdminLoginOtp',
  {
    id: {
      type: DataTypes.UUID,
      defaultValue: DataTypes.UUIDV4,
      primaryKey: true,
    },
    code: {
      type: DataTypes.STRING(6),
      allowNull: false,
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: false,
    },
    verifiedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    verifiedBy: {
      type: DataTypes.BIGINT,
      allowNull: true,
    },
    usedAt: {
      type: DataTypes.DATE,
      allowNull: true,
    },
    clientIp: {
      type: DataTypes.STRING,
      defaultValue: '',
    },
    userAgent: {
      type: DataTypes.TEXT,
      defaultValue: '',
    },
  },
  {
    timestamps: true,
    tableName: 'admin_login_otps',
  }
);

module.exports = AdminLoginOtp;
