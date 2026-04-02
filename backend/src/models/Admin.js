const { DataTypes } = require('sequelize');
const { sequelize } = require('../db');

const DEFAULT_KEYBOARDS = [
  { text: '📝 写报告', action: 'write_report' },
  { text: '🔍 查阅报告', action: 'query_report' },
  { text: '📞 联系管理员', action: 'contact_admin' },
  { text: '❓ 操作帮助', action: 'help' },
];

const Admin = sequelize.define('Admin', {
  adminId: {
    type: DataTypes.BIGINT,
    primaryKey: true,
    allowNull: false,
  },
  channelId: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  pushChannelId: {
    type: DataTypes.STRING,
    defaultValue: '',
  },
  startContent: {
    type: DataTypes.JSONB,
    defaultValue: {
      text: '欢迎使用报告管理机器人！',
      mediaType: 'none',
      mediaUrl: '',
      buttons: [],
    },
  },
  keyboards: {
    type: DataTypes.JSONB,
    defaultValue: DEFAULT_KEYBOARDS,
  },
  reportTemplate: {
    type: DataTypes.JSONB,
    defaultValue: { fields: [] },
  },
  reviewFeedback: {
    type: DataTypes.JSONB,
    defaultValue: {
      approved: '✅ 你的报告已通过审核，已推送到频道。',
      rejected: '❌ 你的报告未通过审核，请修改后重新提交。',
      pending: '⏳ 你的报告已提交，等待管理员审核。',
    },
  },
}, {
  timestamps: true,
  tableName: 'admins',
});

module.exports = Admin;
