const express = require('express');
const router = express.Router();

const emailService = require('../services/emailService');
const { getQueueService } = require('../services/queueService');
const validationService = require('../utils/validation');
const fileUploadService = require('../utils/fileUpload');
const { predefinedTemplates, validateTemplate, extractVariables } = require('../utils/templateEngine');
const logger = require('../utils/logger');

/**
 * @swagger
 * components:
 *   schemas:
 *     SingleEmailRequest:
 *       type: object
 *       required:
 *         - to
 *         - subject
 *       properties:
 *         to:
 *           type: string
 *           format: email
 *           description: Địa chỉ email người nhận
 *           example: "user@example.com"
 *         subject:
 *           type: string
 *           description: Tiêu đề email (hỗ trợ template variables)
 *           example: "Welcome {{firstName}}!"
 *         html:
 *           type: string
 *           description: Nội dung HTML của email
 *           example: "<h1>Hello {{firstName}}!</h1>"
 *         text:
 *           type: string
 *           description: Nội dung text thuần của email
 *           example: "Hello {{firstName}}!"
 *         senderName:
 *           type: string
 *           description: Tên người gửi
 *           example: "My Company"
 *         replyTo:
 *           type: string
 *           format: email
 *           description: Địa chỉ email để reply
 *           example: "noreply@example.com"
 *         cc:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           description: Danh sách CC
 *         bcc:
 *           type: array
 *           items:
 *             type: string
 *             format: email
 *           description: Danh sách BCC
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *           description: File đính kèm
 *     
 *     BulkEmailRequest:
 *       type: object
 *       required:
 *         - recipients
 *         - template
 *       properties:
 *         recipients:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               customData:
 *                 type: object
 *                 additionalProperties: true
 *           description: Danh sách người nhận với thông tin cá nhân hóa
 *         template:
 *           type: object
 *           required:
 *             - subject
 *           properties:
 *             subject:
 *               type: string
 *               description: Template tiêu đề email
 *             html:
 *               type: string
 *               description: Template HTML
 *             text:
 *               type: string
 *               description: Template text
 *         options:
 *           type: object
 *           properties:
 *             senderName:
 *               type: string
 *             replyTo:
 *               type: string
 *               format: email
 *             priority:
 *               type: integer
 *               minimum: 0
 *               maximum: 10
 *               description: Độ ưu tiên job (0-10, cao hơn = ưu tiên hơn)
 *             attachments:
 *               type: array
 *               items:
 *                 type: object
 *     
 *     JobStatus:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         state:
 *           type: string
 *           enum: [waiting, active, completed, failed]
 *         progress:
 *           type: number
 *           minimum: 0
 *           maximum: 100
 *         result:
 *           type: object
 *         createdAt:
 *           type: string
 *           format: date-time
 *         processedAt:
 *           type: string
 *           format: date-time
 *         finishedAt:
 *           type: string
 *           format: date-time
 *         attempts:
 *           type: integer
 *         maxAttempts:
 *           type: integer
 *     
 *     QueueStats:
 *       type: object
 *       properties:
 *         waiting:
 *           type: integer
 *         active:
 *           type: integer
 *         completed:
 *           type: integer
 *         failed:
 *           type: integer
 *         total:
 *           type: integer
 *         type:
 *           type: string
 *           enum: [redis, memory]
 *     
 *     EmailAccount:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *         email:
 *           type: string
 *         isAvailable:
 *           type: boolean
 *         dailyLimit:
 *           type: integer
 *         dailyUsage:
 *           type: integer
 *         lastUsed:
 *           type: string
 *           format: date-time
 *   
 *   responses:
 *     ValidationError:
 *       description: Lỗi validation dữ liệu đầu vào
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               error:
 *                 type: string
 *                 example: "Validation failed"
 *               details:
 *                 type: array
 *                 items:
 *                   type: string
 *     
 *     ServerError:
 *       description: Lỗi server nội bộ
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               success:
 *                 type: boolean
 *                 example: false
 *               error:
 *                 type: string
 */

/**
 * @swagger
 * /api/email/health:
 *   get:
 *     summary: Kiểm tra tình trạng dịch vụ email
 *     description: Endpoint để kiểm tra tình trạng hoạt động của email service, queue và các tài khoản Gmail
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
    const connectionTest = await emailService.testEmailConnection();
    const accountsStatus = emailService.getEmailAccountsStatus();
    const queueService = getQueueService();
    const queueStats = queueService ? await queueService.getQueueStats() : { error: 'Queue not initialized' };

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      emailConnections: connectionTest,
      accounts: accountsStatus,
      queue: queueStats,
      queueType: queueService ? queueService.getQueueType() : 'none'
    });
  } catch (error) {
    logger.error('Email health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
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
 *     description: Gửi một email đến một người nhận cụ thể. Hỗ trợ template variables và validation nội dung.
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
 *                     timestamp:
 *                       type: string
 *                       format: date-time
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
    
    if (contentValidation.warnings.length > 0) {
      logger.warn('Email content warnings:', contentValidation.warnings);
    }

    // Send email directly
    const result = await emailService.sendSingleEmail(value);

    res.json({
      success: true,
      result,
      contentWarnings: contentValidation.warnings
    });

  } catch (error) {
    logger.error('Single email send failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/send-queued:
 *   post:
 *     summary: Gửi email đơn lẻ qua queue
 *     description: Gửi một email đến một người nhận thông qua hệ thống queue (cho email có độ ưu tiên hoặc delay)
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             allOf:
 *               - $ref: '#/components/schemas/SingleEmailRequest'
 *               - type: object
 *                 properties:
 *                   options:
 *                     type: object
 *                     properties:
 *                       priority:
 *                         type: integer
 *                         minimum: 0
 *                         maximum: 10
 *                         description: Độ ưu tiên (0-10)
 *                       delay:
 *                         type: integer
 *                         minimum: 0
 *                         description: Delay trước khi gửi (milliseconds)
 *     responses:
 *       200:
 *         description: Email job đã được thêm vào queue
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
 *                   description: ID của job để theo dõi
 *                 message:
 *                   type: string
 *                   example: "Single email job added to queue"
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-queued', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

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

    // Add to queue
    const job = await queueService.addSingleEmailJob(value, req.body.options || {});

    res.json({
      success: true,
      jobId: job.id,
      message: 'Single email job added to queue'
    });

  } catch (error) {
    logger.error('Queued single email failed:', error);
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
 *     description: Gửi email đến nhiều người nhận với template engine và job queue. Hỗ trợ personalization và progress tracking.
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
 *                 queueType:
 *                   type: string
 *                   enum: [redis, memory]
 *                   description: Loại queue đang sử dụng
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/send-bulk', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

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
    const templateValidation = validateTemplate(template.subject);
    if (!templateValidation.valid) {
      return res.status(400).json({
        error: 'Template validation failed',
        details: templateValidation.error
      });
    }

    // Add to queue
    const job = await queueService.addBulkEmailJob(recipients, template, options);

    res.json({
      success: true,
      jobId: job.id,
      recipients: recipients.length,
      message: 'Bulk email job added to queue',
      estimatedProcessingTime: `${Math.ceil(recipients.length * 1.5 / 60)} minutes`,
      queueType: queueService.getQueueType()
    });

  } catch (error) {
    logger.error('Bulk email job creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/upload-csv:
 *   post:
 *     summary: Upload CSV và gửi email hàng loạt
 *     description: Upload file CSV chứa danh sách email và extract recipients để gửi bulk email
 *     tags: [Email]
 *     consumes:
 *       - multipart/form-data
 *     parameters:
 *       - in: formData
 *         name: csvFile
 *         type: file
 *         required: true
 *         description: File CSV chứa danh sách email
 *       - in: formData
 *         name: emailColumn
 *         type: string
 *         required: true
 *         description: Tên cột chứa email trong CSV
 *       - in: formData
 *         name: delimiter
 *         type: string
 *         description: "Ký tự phân cách (default: comma)"
 *     responses:
 *       200:
 *         description: CSV parsed thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 recipients:
 *                   type: array
 *                   items:
 *                     type: object
 *                 summary:
 *                   type: object
 *                 errors:
 *                   type: array
 *       400:
 *         $ref: '#/components/responses/ValidationError'
 *       500:
 *         $ref: '#/components/responses/ServerError'
 */
router.post('/upload-csv', fileUploadService.uploadCsvFile(), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        error: 'No CSV file uploaded'
      });
    }

    // Validate CSV configuration
    const { error, value } = validationService.validateCsvUpload(req.body);
    if (error) {
      await fileUploadService.cleanupFile(req.file.path);
      return res.status(400).json({
        error: 'CSV configuration validation failed',
        details: error.details.map(detail => detail.message)
      });
    }

    // Parse CSV file
    const csvResult = await fileUploadService.parseCsvFile(req.file.path, value);
    
    // Clean up CSV file
    await fileUploadService.cleanupFile(req.file.path);

    if (csvResult.recipients.length === 0) {
      return res.status(400).json({
        error: 'No valid email addresses found in CSV',
        errors: csvResult.errors,
        summary: csvResult.summary
      });
    }

    res.json({
      success: true,
      recipients: csvResult.recipients,
      summary: csvResult.summary,
      errors: csvResult.errors,
      message: `${csvResult.recipients.length} email addresses extracted successfully`
    });

  } catch (error) {
    logger.error('CSV upload failed:', error);
    
    // Clean up file if it exists
    if (req.file) {
      await fileUploadService.cleanupFile(req.file.path);
    }

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
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    const { jobId } = req.params;
    const status = await queueService.getJobStatus(jobId);

    res.json({
      success: true,
      job: status
    });

  } catch (error) {
    logger.error('Get job status failed:', error);
    res.status(404).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/queue/stats:
 *   get:
 *     summary: Thống kê queue
 *     description: Lấy thống kê về số lượng job trong các trạng thái khác nhau của queue
 *     tags: [Queue]
 *     responses:
 *       200:
 *         description: Thống kê queue
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 queue:
 *                   $ref: '#/components/schemas/QueueStats'
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    const stats = await queueService.getQueueStats();

    res.json({
      success: true,
      queue: stats,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('Get queue stats failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/job/{jobId}:
 *   delete:
 *     summary: Hủy job
 *     description: Hủy một job đang chờ trong queue
 *     tags: [Queue]
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         description: ID của job cần hủy
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Job đã được hủy thành công
 *       404:
 *         description: Job không tìm thấy
 *       500:
 *         description: Không thể hủy job
 */
router.delete('/job/:jobId', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    const { jobId } = req.params;
    await queueService.cancelJob(jobId);

    res.json({
      success: true,
      message: `Job ${jobId} cancelled successfully`
    });

  } catch (error) {
    logger.error('Cancel job failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/queue/pause:
 *   post:
 *     summary: Tạm dừng queue
 *     description: Tạm dừng xử lý queue (không ảnh hưởng đến job đang chạy)
 *     tags: [Queue]
 *     responses:
 *       200:
 *         description: Queue đã được tạm dừng
 */
router.post('/queue/pause', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    await queueService.pauseQueue();
    res.json({
      success: true,
      message: 'Email queue paused'
    });
  } catch (error) {
    logger.error('Pause queue failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/queue/resume:
 *   post:
 *     summary: Tiếp tục queue
 *     description: Tiếp tục xử lý queue sau khi tạm dừng
 *     tags: [Queue]
 *     responses:
 *       200:
 *         description: Queue đã được tiếp tục
 */
router.post('/queue/resume', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    await queueService.resumeQueue();
    res.json({
      success: true,
      message: 'Email queue resumed'
    });
  } catch (error) {
    logger.error('Resume queue failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/accounts:
 *   get:
 *     summary: Thông tin tài khoản email
 *     description: Lấy thông tin trạng thái các tài khoản Gmail được cấu hình
 *     tags: [Accounts]
 *     responses:
 *       200:
 *         description: Danh sách tài khoản email
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 accounts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/EmailAccount'
 *                 totalAccounts:
 *                   type: integer
 *                 availableAccounts:
 *                   type: integer
 */
router.get('/accounts', async (req, res) => {
  try {
    const accounts = emailService.getEmailAccountsStatus();
    
    res.json({
      success: true,
      accounts,
      totalAccounts: accounts.length,
      availableAccounts: accounts.filter(acc => acc.isAvailable).length
    });

  } catch (error) {
    logger.error('Get accounts status failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/templates:
 *   get:
 *     summary: Danh sách template có sẵn
 *     description: Lấy danh sách các email template được định nghĩa sẵn
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: Danh sách template
 */
router.get('/templates', (req, res) => {
  try {
    const templates = Object.keys(predefinedTemplates).map(key => ({
      id: key,
      name: key,
      ...predefinedTemplates[key],
      variables: extractVariables(predefinedTemplates[key].subject + ' ' + (predefinedTemplates[key].html || predefinedTemplates[key].text))
    }));

    res.json({
      success: true,
      templates
    });

  } catch (error) {
    logger.error('Get templates failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/templates/validate:
 *   post:
 *     summary: Validate email template
 *     description: Kiểm tra tính hợp lệ của template và extract variables
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               template:
 *                 type: object
 *                 properties:
 *                   subject:
 *                     type: string
 *                   html:
 *                     type: string
 *                   text:
 *                     type: string
 *     responses:
 *       200:
 *         description: Kết quả validation
 */
router.post('/templates/validate', (req, res) => {
  try {
    const { template } = req.body;
    
    if (!template) {
      return res.status(400).json({
        error: 'Template is required'
      });
    }

    const subjectValidation = validateTemplate(template.subject || '');
    const htmlValidation = template.html ? validateTemplate(template.html) : { valid: true };
    const textValidation = template.text ? validateTemplate(template.text) : { valid: true };

    const variables = extractVariables(
      (template.subject || '') + ' ' + 
      (template.html || '') + ' ' + 
      (template.text || '')
    );

    res.json({
      success: true,
      validation: {
        subject: subjectValidation,
        html: htmlValidation,
        text: textValidation,
        overall: subjectValidation.valid && htmlValidation.valid && textValidation.valid
      },
      variables
    });

  } catch (error) {
    logger.error('Template validation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/queue/clean:
 *   post:
 *     summary: Dọn dẹp queue
 *     description: Xóa các job completed/failed cũ khỏi queue
 *     tags: [Queue]
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               olderThanHours:
 *                 type: integer
 *                 default: 24
 *                 description: Xóa job cũ hơn số giờ này
 *     responses:
 *       200:
 *         description: Dọn dẹp thành công
 */
router.post('/queue/clean', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) {
      return res.status(503).json({
        success: false,
        error: 'Queue service not available'
      });
    }

    const { olderThanHours = 24 } = req.body;
    const result = await queueService.cleanQueue(olderThanHours * 60 * 60 * 1000);

    res.json({
      success: true,
      cleaned: result,
      message: `Cleaned ${result.completed} completed and ${result.failed} failed jobs`
    });

  } catch (error) {
    logger.error('Clean queue failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/send-mail:
 *   post:
 *     summary: Gửi email với SMTP tùy chỉnh
 *     description: Gửi email sử dụng thông tin SMTP được cung cấp trực tiếp trong request
 *     tags: [Email]
 *     requestBody:
 *       required: true
 *       content:
 *         application/x-www-form-urlencoded:
 *           schema:
 *             type: object
 *             required:
 *               - to_email
 *               - subject
 *               - body
 *               - smtp_user
 *               - smtp_pass
 *             properties:
 *               to_email:
 *                 type: string
 *                 format: email
 *                 description: Email người nhận
 *                 example: "recipient@example.com"
 *               subject:
 *                 type: string
 *                 description: Tiêu đề email
 *                 example: "Hello from Custom SMTP"
 *               body:
 *                 type: string
 *                 description: Nội dung email (HTML hoặc text)
 *                 example: "<h1>Hello!</h1><p>This is a test email.</p>"
 *               smtp_user:
 *                 type: string
 *                 format: email
 *                 description: Email người gửi (Gmail)
 *                 example: "sender@gmail.com"
 *               smtp_server:
 *                 type: string
 *                 description: SMTP server
 *                 default: "smtp.gmail.com"
 *                 example: "smtp.gmail.com"
 *               smtp_port:
 *                 type: integer
 *                 description: SMTP port
 *                 default: 587
 *                 example: 587
 *               smtp_pass:
 *                 type: string
 *                 description: Mật khẩu ứng dụng Gmail (App Password)
 *                 example: "abcd efgh ijkl mnop"
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - to_email
 *               - subject
 *               - body
 *               - smtp_user
 *               - smtp_pass
 *             properties:
 *               to_email:
 *                 type: string
 *                 format: email
 *               subject:
 *                 type: string
 *               body:
 *                 type: string
 *               smtp_user:
 *                 type: string
 *                 format: email
 *               smtp_server:
 *                 type: string
 *                 default: "smtp.gmail.com"
 *               smtp_port:
 *                 type: integer
 *                 default: 587
 *               smtp_pass:
 *                 type: string
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
 *                 message:
 *                   type: string
 *                   example: "Email sent successfully"
 *                 messageId:
 *                   type: string
 *                   description: ID của email đã gửi
 *                 recipient:
 *                   type: string
 *                   description: Email người nhận
 *                 sender:
 *                   type: string
 *                   description: Email người gửi
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       400:
 *         description: Thiếu thông tin bắt buộc hoặc dữ liệu không hợp lệ
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
 *                   example: "Missing required fields"
 *                 details:
 *                   type: array
 *                   items:
 *                     type: string
 *       500:
 *         description: Lỗi gửi email
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
 *                   example: "Failed to send email"
 */
router.post('/send-mail', async (req, res) => {
  try {
    // Extract data from form-encoded or JSON body
    const {
      to_email,
      subject,
      body,
      smtp_user,
      smtp_server = 'smtp.gmail.com',
      smtp_port = 587,
      smtp_pass
    } = req.body;

    // Validate required fields
    const missingFields = [];
    if (!to_email) missingFields.push('to_email');
    if (!subject) missingFields.push('subject');
    if (!body) missingFields.push('body');
    if (!smtp_user) missingFields.push('smtp_user');
    if (!smtp_pass) missingFields.push('smtp_pass');

    if (missingFields.length > 0) {
      return res.status(400).json({
        success: false,
        error: 'Missing required fields',
        details: missingFields.map(field => `${field} is required`)
      });
    }

    // Validate email formats
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to_email)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid recipient email format'
      });
    }

    if (!emailRegex.test(smtp_user)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid sender email format'
      });
    }

    // Create custom SMTP transporter
    const nodemailer = require('nodemailer');
    
    const transporter = nodemailer.createTransport({
      host: smtp_server,
      port: parseInt(smtp_port),
      secure: false, // true for 465, false for other ports
      auth: {
        user: smtp_user,
        pass: smtp_pass
      },
      tls: {
        rejectUnauthorized: false
      }
    });

    // Verify SMTP connection
    try {
      await transporter.verify();
      logger.info(`✅ SMTP connection verified for ${smtp_user}`);
    } catch (verifyError) {
      logger.error('❌ SMTP verification failed:', verifyError);
      return res.status(400).json({
        success: false,
        error: 'SMTP authentication failed',
        details: verifyError.message
      });
    }

    // Prepare email options
    const mailOptions = {
      from: smtp_user,
      to: to_email,
      subject: subject,
      html: body,
      text: body.replace(/<[^>]*>/g, '') // Strip HTML for text version
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    logger.info(`📧 Email sent successfully via custom SMTP from ${smtp_user} to ${to_email}`);

    res.json({
      success: true,
      message: 'Email sent successfully',
      messageId: info.messageId,
      recipient: to_email,
      sender: smtp_user,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    logger.error('❌ Custom SMTP email send failed:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to send email',
      details: error.message
    });
  }
});

/**
 * @swagger
 * /api/email/test:
 *   get:
 *     summary: Test endpoint
 *     description: Endpoint đơn giản để test API connectivity
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
 *                   example: "Email API is working"
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 version:
 *                   type: string
 *                   example: "v1.0.0"
 */
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Email API is working',
    timestamp: new Date().toISOString(),
    version: 'v1.0.0'
  });
});

module.exports = router;
