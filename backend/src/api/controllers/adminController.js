const Admin = require('../../models/Admin');
const config = require('../../config');

/**
 * Get admin configuration
 */
async function getConfig(req, res) {
  try {
    let admin = await Admin.findOne({ adminId: config.ADMIN_ID });
    if (!admin) {
      admin = new Admin({ adminId: config.ADMIN_ID });
      await admin.save();
    }
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Update admin configuration
 * Only explicitly allowed fields are updated to prevent NoSQL injection.
 */
async function updateConfig(req, res) {
  try {
    const body = req.body;
    // Allowlist of updatable fields with type-safe extraction
    const safeUpdates = {};
    if (typeof body.channelId === 'string') safeUpdates.channelId = body.channelId.slice(0, 100);
    if (typeof body.pushChannelId === 'string') safeUpdates.pushChannelId = body.pushChannelId.slice(0, 100);
    if (body.startContent && typeof body.startContent === 'object') {
      const sc = body.startContent;
      safeUpdates.startContent = {};
      if (typeof sc.text === 'string') safeUpdates.startContent.text = sc.text.slice(0, 4096);
      if (['none', 'photo', 'video'].includes(sc.mediaType)) safeUpdates.startContent.mediaType = sc.mediaType;
      if (typeof sc.mediaUrl === 'string') safeUpdates.startContent.mediaUrl = sc.mediaUrl.slice(0, 1000);
      if (Array.isArray(sc.buttons)) {
        safeUpdates.startContent.buttons = sc.buttons.slice(0, 10).map((b) => ({
          text: String(b.text || '').slice(0, 64),
          url: String(b.url || '').slice(0, 500),
          action: String(b.action || '').slice(0, 64),
        }));
      }
    }
    if (Array.isArray(body.keyboards)) {
      safeUpdates.keyboards = body.keyboards.slice(0, 10).map((k) => ({
        text: String(k.text || '').slice(0, 64),
        action: String(k.action || '').slice(0, 64),
      }));
    }
    if (body.reviewFeedback && typeof body.reviewFeedback === 'object') {
      const rf = body.reviewFeedback;
      safeUpdates.reviewFeedback = {};
      if (typeof rf.approved === 'string') safeUpdates.reviewFeedback.approved = rf.approved.slice(0, 1000);
      if (typeof rf.rejected === 'string') safeUpdates.reviewFeedback.rejected = rf.rejected.slice(0, 1000);
      if (typeof rf.pending === 'string') safeUpdates.reviewFeedback.pending = rf.pending.slice(0, 1000);
    }
    if (body.reportTemplate && Array.isArray(body.reportTemplate.fields)) {
      safeUpdates.reportTemplate = {
        fields: body.reportTemplate.fields.slice(0, 20).map((f) => ({
          name: String(f.name || '').slice(0, 64),
          label: String(f.label || '').slice(0, 128),
          type: ['text', 'textarea', 'select'].includes(f.type) ? f.type : 'text',
          required: Boolean(f.required),
          options: Array.isArray(f.options) ? f.options.slice(0, 20).map((o) => String(o).slice(0, 128)) : [],
        })),
      };
    }

    const admin = await Admin.findOneAndUpdate(
      { adminId: config.ADMIN_ID },
      { $set: safeUpdates },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getConfig, updateConfig };
