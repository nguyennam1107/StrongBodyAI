const express = require('express');
const router = express.Router();
const emailService = require('../../services/emailService');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/accounts:
 *   get:
 *     summary: Thông tin tài khoản email
 *     description: Liệt kê trạng thái các tài khoản cấu hình (sẵn sàng, giới hạn ngày, còn lại...).
 *     tags: [Accounts]
 *     responses:
 *       200: { description: OK }
 */
router.get('/accounts', async (req, res) => {
  try {
    const accounts = emailService.getEmailAccountsStatus();
    res.json({ success: true, accounts, totalAccounts: accounts.length, availableAccounts: accounts.filter(acc => acc.isAvailable).length });
  } catch (err) {
    logger.error('Get accounts status failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
