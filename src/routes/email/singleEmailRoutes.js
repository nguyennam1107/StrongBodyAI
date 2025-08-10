const express = require('express');
const router = express.Router();
const validationService = require('../../utils/validation');
const emailService = require('../../services/emailService');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/send:
 *   post:
 *     summary: Gửi email đơn lẻ
 *     tags: [Email]
 */
router.post('/send', async (req, res) => {
  try {
    const { error, value } = validationService.validateSingleEmail(req.body);
    if (error) {
      return res.status(400).json({
        error: 'Validation failed',
        details: error.details.map(d => d.message)
      });
    }
    if (value.html) value.html = validationService.sanitizeEmailContent(value.html);
    const content = value.html || value.text;
    const contentValidation = validationService.validateEmailContent(content);
    if (contentValidation.warnings.length) {
      logger.warn('Email content warnings:', contentValidation.warnings);
    }
    const result = await emailService.sendSingleEmail(value);
    res.json({ success: true, result, contentWarnings: contentValidation.warnings });
  } catch (err) {
    logger.error('Single email send failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/send-mail:
 *   post:
 *     summary: Gửi email với SMTP tùy chỉnh
 *     tags: [Email]
 */
router.post('/send-mail', async (req, res) => {
  try {
    const { to_email, subject, body, smtp_user, smtp_server = 'smtp.gmail.com', smtp_port = 587, smtp_pass } = req.body;
    const missing = [];
    if (!to_email) missing.push('to_email');
    if (!subject) missing.push('subject');
    if (!body) missing.push('body');
    if (!smtp_user) missing.push('smtp_user');
    if (!smtp_pass) missing.push('smtp_pass');
    if (missing.length) {
      return res.status(400).json({ success: false, error: 'Missing required fields', details: missing.map(f => `${f} is required`) });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to_email)) return res.status(400).json({ success: false, error: 'Invalid recipient email format' });
    if (!emailRegex.test(smtp_user)) return res.status(400).json({ success: false, error: 'Invalid sender email format' });
    const nodemailer = require('nodemailer');
    const transporter = nodemailer.createTransport({
      host: smtp_server,
      port: parseInt(smtp_port),
      secure: false,
      auth: { user: smtp_user, pass: smtp_pass },
      tls: { rejectUnauthorized: false }
    });
    try {
      await transporter.verify();
      logger.info(`SMTP connection verified for ${smtp_user}`);
    } catch (vErr) {
      logger.error('SMTP verification failed:', vErr);
      return res.status(400).json({ success: false, error: 'SMTP authentication failed', details: vErr.message });
    }
    const info = await transporter.sendMail({ from: smtp_user, to: to_email, subject, html: body, text: body.replace(/<[^>]*>/g, '') });
    logger.info(`Email sent via custom SMTP from ${smtp_user} to ${to_email}`);
    res.json({ success: true, message: 'Email sent successfully', messageId: info.messageId, recipient: to_email, sender: smtp_user, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Custom SMTP email send failed:', err);
    res.status(500).json({ success: false, error: 'Failed to send email', details: err.message });
  }
});

module.exports = router;
