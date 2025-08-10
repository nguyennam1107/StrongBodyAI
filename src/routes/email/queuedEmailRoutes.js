const express = require('express');
const router = express.Router();
const validationService = require('../../utils/validation');
const { getQueueService } = require('../../services/queueService');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/send-queued:
 *   post:
 *     summary: Gửi email đơn lẻ qua queue
 *     tags: [Email]
 */
router.post('/send-queued', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    const { error, value } = validationService.validateSingleEmail(req.body);
    if (error) return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
    if (value.html) value.html = validationService.sanitizeEmailContent(value.html);
    const job = await queueService.addSingleEmailJob(value, req.body.options || {});
    res.json({ success: true, jobId: job.id, message: 'Single email job added to queue' });
  } catch (err) {
    logger.error('Queued single email failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
