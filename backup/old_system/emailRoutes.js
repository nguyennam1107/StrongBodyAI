const express = require('express');
const router = express.Router();

const emailService = require('../services/emailService');
const { emailQueueService } = require('../services/simpleEmailQueue');
const validationService = require('../utils/validation');
const fileUploadService = require('../utils/fileUpload');
const { predefinedTemplates, validateTemplate, extractVariables } = require('../utils/templateEngine');
const logger = require('../utils/logger');

// Health check for email service
router.get('/health', async (req, res) => {
  try {
    const connectionTest = await emailService.testEmailConnection();
    const accountsStatus = emailService.getEmailAccountsStatus();
    const queueStats = await emailQueueService.getQueueStats();

    res.json({
      status: 'OK',
      timestamp: new Date().toISOString(),
      emailConnections: connectionTest,
      accounts: accountsStatus,
      queue: queueStats
    });
  } catch (error) {
    logger.error('Email health check failed:', error);
    res.status(500).json({
      status: 'ERROR',
      error: error.message
    });
  }
});

// Send single email
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

    // Send email
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

// Send bulk emails (queued)
router.post('/send-bulk', async (req, res) => {
  try {
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
    const job = await emailQueueService.addBulkEmailJob(recipients, template, options);

    res.json({
      success: true,
      jobId: job.id,
      recipients: recipients.length,
      message: 'Bulk email job added to queue',
      estimatedProcessingTime: `${Math.ceil(recipients.length * 1.5 / 60)} minutes`
    });

  } catch (error) {
    logger.error('Bulk email job creation failed:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Upload CSV and send bulk emails
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

// Get job status
router.get('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const status = await emailQueueService.getJobStatus(jobId);

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

// Get queue statistics
router.get('/queue/stats', async (req, res) => {
  try {
    const stats = await emailQueueService.getQueueStats();

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

// Cancel job
router.delete('/job/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    await emailQueueService.cancelJob(jobId);

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

// Pause/Resume queue
router.post('/queue/pause', async (req, res) => {
  try {
    await emailQueueService.pauseQueue();
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

router.post('/queue/resume', async (req, res) => {
  try {
    await emailQueueService.resumeQueue();
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

// Get email accounts status
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

// Get predefined templates
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

// Validate template
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

// Clean queue
router.post('/queue/clean', async (req, res) => {
  try {
    const { olderThanHours = 24 } = req.body;
    const result = await emailQueueService.cleanQueue(olderThanHours * 60 * 60 * 1000);

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

module.exports = router;
