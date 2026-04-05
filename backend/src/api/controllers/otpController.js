const { Op } = require('sequelize');
const AdminLoginOtp = require('../../models/AdminLoginOtp');
const { generateToken } = require('../../utils/auth');

const OTP_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * POST /api/auth/otp/request
 * Generate a 6-digit OTP for browser-based admin login.
 * Returns { otpId, code, expiresIn }.
 */
async function requestOtp(req, res) {
  try {
    // Clean up old expired/used OTPs for the same IP (best-effort housekeeping)
    await AdminLoginOtp.destroy({
      where: {
        clientIp: req.ip || '',
        expiresAt: { [Op.lt]: new Date() },
      },
    }).catch(() => {});

    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + OTP_TTL_MS);

    const otp = await AdminLoginOtp.create({
      code,
      expiresAt,
      clientIp: req.ip || '',
      userAgent: (req.headers['user-agent'] || '').slice(0, 500),
    });

    return res.json({
      success: true,
      otpId: otp.id,
      code,
      expiresIn: Math.floor(OTP_TTL_MS / 1000),
    });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * GET /api/auth/otp/status?otpId=...
 * Poll verification status.
 * Returns { status: 'pending' | 'verified' | 'expired' | 'used', token? }.
 * On first 'verified' read the token is returned and the OTP is marked used.
 */
async function otpStatus(req, res) {
  try {
    const { otpId } = req.query;
    if (!otpId || typeof otpId !== 'string') {
      return res.status(400).json({ success: false, message: '缺少 otpId' });
    }

    const otp = await AdminLoginOtp.findByPk(otpId);
    if (!otp) {
      return res.status(404).json({ success: false, message: 'OTP 不存在' });
    }

    if (otp.usedAt) {
      return res.json({ success: true, status: 'used' });
    }

    if (new Date() > otp.expiresAt) {
      return res.json({ success: true, status: 'expired' });
    }

    if (otp.verifiedAt) {
      // Mark as used immediately to prevent token replay
      await otp.update({ usedAt: new Date() });
      const token = generateToken({
        userId: Number(otp.verifiedBy),
        isAdmin: true,
      });
      return res.json({ success: true, status: 'verified', token });
    }

    return res.json({ success: true, status: 'pending' });
  } catch (err) {
    return res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { requestOtp, otpStatus };
