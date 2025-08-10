const express = require('express');
const router = express.Router();
const validationService = require('../../utils/validation');
const { getQueueService } = require('../../services/queueService');
const { validateTemplate } = require('../../utils/templateEngine');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/send-bulk:
 *   post:
 *     summary: Gửi email hàng loạt
 *     description: Gửi email đến nhiều người nhận với template và personalization. Job được xử lý nền qua queue.
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [recipients, template]
 *             properties:
 *               recipients:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [email]
 *                   properties:
 *                     email: { type: string, format: email }
 *                     firstName: { type: string }
 *                     lastName: { type: string }
 *                     customData: { type: object, additionalProperties: true }
 *               template:
 *                 type: object
 *                 required: [subject]
 *                 properties:
 *                   subject: { type: string, example: Hello {{firstName}} }
 *                   html: { type: string, example: <h1>Hello {{firstName}}</h1> }
 *                   text: { type: string }
 *               options:
 *                 type: object
 *                 properties:
 *                   senderName: { type: string }
 *                   replyTo: { type: string, format: email }
 *                   priority: { type: integer, minimum: 0, maximum: 10, example: 5 }
 *     responses:
 *       200:
 *         description: Job bulk đã được thêm vào queue
 *       400:
 *         description: Lỗi validation
 *       503:
 *         description: Queue service không khả dụng
 *       500:
 *         description: Lỗi server
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    const { error, value } = validationService.validateBulkEmail(req.body);
    if (error) return res.status(400).json({ error: 'Validation failed', details: error.details.map(d => d.message) });
    const { recipients, template, options = {} } = value;
    if (template.html) template.html = validationService.sanitizeEmailContent(template.html);
    const templateValidation = validateTemplate(template.subject);
    if (!templateValidation.valid) return res.status(400).json({ error: 'Template validation failed', details: templateValidation.error });
    const job = await queueService.addBulkEmailJob(recipients, template, options);
    res.json({ success: true, jobId: job.id, recipients: recipients.length, message: 'Bulk email job added to queue', estimatedProcessingTime: `${Math.ceil(recipients.length * 1.5 / 60)} minutes`, queueType: queueService.getQueueType() });
  } catch (err) {
    logger.error('Bulk email job creation failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
