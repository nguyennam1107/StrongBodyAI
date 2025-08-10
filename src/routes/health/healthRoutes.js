const express = require('express');
const router = express.Router();
const emailService = require('../../services/emailService');
const { getQueueService } = require('../../services/queueService');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/health:
 *   get:
 *     summary: Kiểm tra tình trạng dịch vụ email
 *     tags: [Health]
 */
router.get('/health', async (req, res) => {
  try {
    const connectionTest = await emailService.testEmailConnection();
    const accountsStatus = emailService.getEmailAccountsStatus();
    const queueService = getQueueService();
    const queueStats = queueService ? await queueService.getQueueStats() : { error: 'Queue not initialized' };
    res.json({ status: 'OK', timestamp: new Date().toISOString(), emailConnections: connectionTest, accounts: accountsStatus, queue: queueStats, queueType: queueService ? queueService.getQueueType() : 'none' });
  } catch (err) {
    logger.error('Email health check failed:', err);
    res.status(500).json({ status: 'ERROR', error: err.message, timestamp: new Date().toISOString() });
  }
});

/**
 * @swagger
 * /api/email/test:
 *   get:
 *     summary: Test endpoint
 *     tags: [Health]
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Email API is working', timestamp: new Date().toISOString(), version: 'v1.0.0' });
});

module.exports = router;
