const express = require('express');
const router = express.Router();

// Lazy load services để tránh circular dependency
let emailService;
let emailQueueService;
let validationService;
let fileUploadService;
let templateUtils;

const loadServices = () => {
  if (!emailService) {
    console.log('🔄 Lazy loading emailService...');
    emailService = require('../services/emailService');
  }
  if (!emailQueueService) {
    console.log('🔄 Lazy loading emailQueueService...');
    const { emailQueueService: eqs } = require('../services/simpleEmailQueue');
    emailQueueService = eqs;
  }
  if (!validationService) {
    console.log('🔄 Lazy loading validation...');
    validationService = require('../utils/validation');
  }
  if (!fileUploadService) {
    console.log('🔄 Lazy loading fileUpload...');
    fileUploadService = require('../utils/fileUpload');
  }
  if (!templateUtils) {
    console.log('🔄 Lazy loading templateEngine...');
    const { predefinedTemplates, validateTemplate, extractVariables } = require('../utils/templateEngine');
    templateUtils = { predefinedTemplates, validateTemplate, extractVariables };
  }
};

console.log('📋 Routes module loaded (services will be lazy loaded)');

/**
 * @swagger
 * /api/email/health:
 *   get:
 *     summary: Kiểm tra tình trạng dịch vụ email
 *     description: Endpoint để kiểm tra tình trạng hoạt động của email service và các tài khoản Gmail
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Service đang hoạt động bình thường
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: OK
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 emailConnections:
 *                   type: object
 *                   description: Trạng thái kết nối email
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailAccount'
 *                 queue:
 *                   $ref: '#/components/schemas/QueueStats'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.get('/health', async (req, res) => {
  try {
    loadServices();
    
    res.json({
      status: 'OK',
      message: 'Email service is running',
      timestamp: new Date().toISOString(),
      emailAccounts: emailService.getAccountsStatus(),
      queueStatus: emailQueueService.getStatus()
    });
  } catch (error) {
    res.status(500).json({
      status: 'ERROR',
      message: 'Email service encountered an error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
});

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: Gửi email đơn lẻ
 *     description: Gửi một email đến một người nhận cụ thể
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/SingleEmailRequest'
 *           examples:
 *             simple:
 *               summary: Email đơn giản
 *               value:
 *                 to: "recipient@example.com"
 *                 subject: "Hello from API!"
 *                 html: "<h1>Hello!</h1><p>This is a test email from Bulk Email Server.</p>"
 *                 text: "Hello! This is a test email from Bulk Email Server."
 *                 senderName: "My Company"
 *             template:
 *               summary: Email với template variables
 *               value:
 *                 to: "user@example.com"
 *                 subject: "Welcome {{name}}!"
 *                 html: "<h1>Welcome {{name}}!</h1><p>Thanks for joining {{company}}!</p>"
 *                 senderName: "Welcome Team"
 *                 replyTo: "noreply@example.com"
 *     responses:
 *       200:
 *         description: Email gửi thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 result:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                       description: ID của email đã gửi
 *                     recipient:
 *                       type: string
 *                       description: Địa chỉ email người nhận
 *                     senderAccount:
 *                       type: string
 *                       description: Tài khoản Gmail đã sử dụng để gửi
 *                 contentWarnings:
 *                   type: array
 *                   description: Cảnh báo về nội dung email
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send', async (req, res) => {
  try {
    loadServices();
    
    // Validate request
    const { error, value } = validationService.validateSingleEmail(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Sanitize content
    if (value.html) {
      value.html = validationService.sanitizeEmailContent(value.html);
    }

    // Validate content for spam indicators
    const content = value.html || value.text;
    const contentValidation = validationService.validateEmailContent(content);

    // Send email
    const result = await emailService.sendSingleEmail(value);

    res.json({
      success: true,
      result,
      contentWarnings: contentValidation.warnings
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/send-bulk:
 *   post:
 *     summary: Gửi email hàng loạt
 *     description: Gửi email đến nhiều người nhận với template engine và job queue
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/BulkEmailRequest'
 *           examples:
 *             newsletter:
 *               summary: Newsletter đến khách hàng
 *               value:
 *                 recipients:
 *                   - email: "john@example.com"
 *                     firstName: "John"
 *                     lastName: "Doe"
 *                     customData:
 *                       company: "ABC Corp"
 *                       position: "Developer"
 *                   - email: "jane@example.com"
 *                     firstName: "Jane"
 *                     lastName: "Smith"
 *                     customData:
 *                       company: "XYZ Ltd"
 *                       position: "Manager"
 *                 template:
 *                   subject: "Welcome {{firstName}}!"
 *                   html: "<h1>Hello {{firstName}}!</h1><p>Welcome to our newsletter. We see you work at {{customData.company}} as {{customData.position}}.</p>"
 *                   text: "Hello {{firstName}}! Welcome to our newsletter."
 *                 options:
 *                   senderName: "Newsletter Team"
 *                   replyTo: "newsletter@example.com"
 *                   priority: 5
 *     responses:
 *       200:
 *         description: Job gửi email hàng loạt đã được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 jobId:
 *                   type: string
 *                   description: ID của job để theo dõi tiến trình
 *                   example: "123"
 *                 recipients:
 *                   type: integer
 *                   description: Số lượng người nhận
 *                   example: 100
 *                 message:
 *                   type: string
 *                   example: "Bulk email job added to queue"
 *                 estimatedProcessingTime:
 *                   type: string
 *                   description: Thời gian ước tính hoàn thành
 *                   example: "3 minutes"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-bulk', async (req, res) => {
  try {
    loadServices();
    
    // Validate request
    const { error, value } = validationService.validateBulkEmail(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    const { recipients, template, options = {} } = value;

    // Sanitize template content
    if (template.html) {
      template.html = validationService.sanitizeEmailContent(template.html);
    }

    // Validate template
    const templateValidation = templateUtils.validateTemplate(template.subject);
    if (!templateValidation.valid) {
      return res.status(400).json({
        error: 'Template validation failed',
        details: templateValidation.error
      });
    }

    // Add to queue
    const job = await emailQueueService.addBulkEmailJob(recipients, template, options);

    res.json({
      success: true,
      jobId: job.id,
      recipients: recipients.length,
      message: 'Bulk email job added to queue',
      estimatedProcessingTime: `${Math.ceil(recipients.length * 1.5 / 60)} minutes`
    });

  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/job/{jobId}:
 *   get:
 *     summary: Kiểm tra trạng thái job
 *     description: Lấy thông tin chi tiết về trạng thái và tiến trình của một job gửi email
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         description: ID của job cần kiểm tra
 *         schema:
 *           type: string
 *           example: "123"
 *     responses:
 *       200:
 *         description: Thông tin job
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 job:
 *                   $ref: '#/components/schemas/JobStatus'
 *       404:
 *         description: Job không tìm thấy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "Job 123 not found"
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    loadServices();
    
    const { jobId } = req.params;
    const status = await emailQueueService.getJobStatus(jobId);

    res.json({
      success: true,
      job: status
    });

  } catch (error) {
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/test:
 *   get:
 *     summary: Test endpoint
 *     description: Endpoint đơn giản để test API
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Test thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Test endpoint working"
 */
router.get('/test', (req, res) => {
  res.json({ message: 'Test endpoint working' });
});

module.exports = router;
