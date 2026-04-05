'use strict';

const { DataTypes } = require('sequelize');

/**
 * Migration: create admin_login_otps table for browser-based OTP admin login.
 */
module.exports = {
  async up(queryInterface) {
    await queryInterface.createTable('admin_login_otps', {
      id: {
        type: DataTypes.UUID,
        defaultValue: DataTypes.UUIDV4,
        primaryKey: true,
        allowNull: false,
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
        allowNull: false,
      },
      userAgent: {
        type: DataTypes.TEXT,
        defaultValue: '',
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.DATE,
        allowNull: false,
      },
    });

    await queryInterface.addIndex('admin_login_otps', ['code']);
    await queryInterface.addIndex('admin_login_otps', ['expiresAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('admin_login_otps');
  },
};
