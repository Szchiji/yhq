const mongoose = require('mongoose');

const ReportSchema = new mongoose.Schema({
  userId: { type: Number, required: true },
  username: { type: String, default: '' },
  firstName: { type: String, default: '' },
  content: { type: mongoose.Schema.Types.Mixed, default: {} },
  title: { type: String, default: '' },
  description: { type: String, default: '' },
  tags: [{ type: String }],
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending',
  },
  reviewedAt: { type: Date },
  reviewedBy: { type: Number },
  reviewNote: { type: String, default: '' },
  channelMessageId: { type: Number },
  reportNumber: { type: Number, unique: true },
}, { timestamps: true });

// Auto-increment reportNumber
ReportSchema.pre('save', async function (next) {
  if (this.isNew) {
    const lastReport = await this.constructor.findOne({}, {}, { sort: { reportNumber: -1 } });
    this.reportNumber = lastReport ? lastReport.reportNumber + 1 : 1;
  }
  next();
});

// Text index for search
ReportSchema.index({ username: 'text', title: 'text', description: 'text', tags: 'text' });
ReportSchema.index({ tags: 1 });
ReportSchema.index({ username: 1 });
ReportSchema.index({ status: 1 });

module.exports = mongoose.model('Report', ReportSchema);
