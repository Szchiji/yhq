const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

/**
 * Stores in-progress (in-bot wizard) report drafts.
 * One draft per user at a time; replaced on new report start.
 */
const ReportDraft = sequelize.define('ReportDraft', {
  userId: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  // Current wizard step index
  currentStep: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  // Filled field values keyed by field name
  data: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  // Template fields snapshot (from admin config at draft creation time)
  templateFields: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  // Message IDs of preview messages sent to the user (for editing)
  previewMessageId: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'report_drafts',
});

module.exports = ReportDraft;
