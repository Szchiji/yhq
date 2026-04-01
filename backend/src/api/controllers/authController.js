const { verifyTelegramInitData, generateToken } = require('../../utils/auth');
const config = require('../../config');

/**
 * Authenticate via Telegram Web App initData
 */
async function telegramAuth(req, res) {
  try {
    const { initData } = req.body;
    if (!initData) {
      return res.status(400).json({ success: false, message: '缺少 initData' });
    }

    const user = verifyTelegramInitData(initData);
    if (!user) {
      return res.status(401).json({ success: false, message: 'initData 验证失败' });
    }

    const isAdmin = user.id === config.ADMIN_ID;
    const token = generateToken({ userId: user.id, username: user.username, isAdmin });

    res.json({
      success: true,
      token,
      user: {
        id: user.id,
        username: user.username,
        firstName: user.first_name,
        isAdmin,
      },
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
}

module.exports = { telegramAuth };
