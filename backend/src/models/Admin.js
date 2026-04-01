const mongoose = require('mongoose');

const AdminSchema = new mongoose.Schema({
  adminId: { type: Number, required: true, unique: true },
  channelId: { type: String, default: '' },
  pushChannelId: { type: String, default: '' },
  startContent: {
    text: { type: String, default: '欢迎使用报告管理机器人！' },
    mediaType: { type: String, enum: ['none', 'photo', 'video'], default: 'none' },
    mediaUrl: { type: String, default: '' },
    buttons: [
      {
        text: { type: String },
        url: { type: String },
        action: { type: String },
      },
    ],
  },
  keyboards: [
    {
      text: { type: String, required: true },
      action: { type: String, required: true },
    },
  ],
  reportTemplate: {
    fields: [
      {
        name: { type: String },
        label: { type: String },
        type: { type: String, enum: ['text', 'textarea', 'select'], default: 'text' },
        required: { type: Boolean, default: false },
        options: [{ type: String }],
      },
    ],
  },
  reviewFeedback: {
    approved: { type: String, default: '✅ 你的报告已通过审核，已推送到频道。' },
    rejected: { type: String, default: '❌ 你的报告未通过审核，请修改后重新提交。' },
    pending: { type: String, default: '⏳ 你的报告已提交，等待管理员审核。' },
  },
}, { timestamps: true });

// Initialize default keyboards if empty
AdminSchema.pre('save', function (next) {
  if (this.keyboards.length === 0) {
    this.keyboards = [
      { text: '📝 写报告', action: 'write_report' },
      { text: '🔍 查阅报告', action: 'query_report' },
      { text: '📞 联系管理员', action: 'contact_admin' },
      { text: '❓ 操作帮助', action: 'help' },
    ];
  }
  next();
});

module.exports = mongoose.model('Admin', AdminSchema);
