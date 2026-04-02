const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const Report = sequelize.define('Report', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  reportNumber: {
    type: DataTypes.INTEGER,
    unique: true,
  },
  userId: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  username: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  firstName: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  content: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  title: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  tags: {
    type: DataTypes.ARRAY(DataTypes.STRING),
    defaultValue: [],
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending',
  },
  reviewedAt: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  reviewedBy: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
  reviewNote: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  channelMessageId: {
    type: DataTypes.BIGINT,
    allowNull: true,
  },
}, {
  timestamps: true,
  tableName: 'reports',
  hooks: {
    beforeCreate: async (report) => {
      const maxReport = await Report.findOne({
        attributes: ['reportNumber'],
        order: [['reportNumber', 'DESC']],
      });
      report.reportNumber = maxReport ? (maxReport.reportNumber || 0) + 1 : 1;
    },
  },
});

module.exports = Report;
