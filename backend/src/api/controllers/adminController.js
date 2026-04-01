const Admin = require('../../models/Admin');
const config = require('../../config');
const { sanitizeMongoQuery } = require('../../utils/sanitize');

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
 */
async function updateConfig(req, res) {
  try {
    const updates = sanitizeMongoQuery(req.body);
    const admin = await Admin.findOneAndUpdate(
      { adminId: config.ADMIN_ID },
      { $set: updates },
      { upsert: true, new: true, runValidators: true }
    );
    res.json({ success: true, data: admin });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { getConfig, updateConfig };
