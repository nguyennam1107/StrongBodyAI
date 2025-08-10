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
 *     description: Thêm email đơn lẻ vào queue để xử lý nền, hỗ trợ priority và delay.
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [to, subject]
 *             properties:
 *               to: { type: string, format: email, example: user@example.com }
 *               subject: { type: string, example: Welcome {{name}} }
 *               html: { type: string, example: <h1>Hello {{name}}</h1> }
 *               text: { type: string, example: Hello plain text }
 *               options:
 *                 type: object
 *                 properties:
 *                   priority: { type: integer, minimum: 0, maximum: 10, example: 5 }
 *                   delay: { type: integer, description: Delay (ms) trước khi gửi, example: 3000 }
 *     responses:
 *       200:
 *         description: Job đã được thêm vào queue
 *       400:
 *         description: Lỗi validation
 *       503:
 *         description: Queue service không khả dụng
 *       500:
 *         description: Lỗi server
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
