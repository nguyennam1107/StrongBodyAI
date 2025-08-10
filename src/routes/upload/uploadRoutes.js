const express = require('express');
const router = express.Router();
const fileUploadService = require('../../utils/fileUpload');
const validationService = require('../../utils/validation');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/upload-csv:
 *   post:
 *     summary: Upload CSV và phân tích recipients
 *     description: Upload file CSV để trích xuất danh sách người nhận. Hỗ trợ tự động nhận diện cột bổ sung làm customData.
 *     tags: [Upload]
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [csvFile, emailColumn]
 *             properties:
 *               csvFile:
 *                 type: string
 *                 format: binary
 *               emailColumn:
 *                 type: string
 *                 default: email
 *               nameColumn:
 *                 type: string
 *                 default: name
 *               firstNameColumn:
 *                 type: string
 *               lastNameColumn:
 *                 type: string
 *               delimiter:
 *                 type: string
 *                 default: ,
 *     responses:
 *       200:
 *         description: Phân tích thành công
 *       400:
 *         description: Lỗi upload hoặc không có email hợp lệ
 *       500:
 *         description: Lỗi server
 */
router.post('/upload-csv', fileUploadService.uploadCsvFile(), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No CSV file uploaded' });
    const { error, value } = validationService.validateCsvUpload(req.body);
    if (error) {
      await fileUploadService.cleanupFile(req.file.path);
      return res.status(400).json({ error: 'CSV configuration validation failed', details: error.details.map(d => d.message) });
    }
    const csvResult = await fileUploadService.parseCsvFile(req.file.path, value);
    await fileUploadService.cleanupFile(req.file.path);
    if (csvResult.recipients.length === 0) {
      return res.status(400).json({ error: 'No valid email addresses found in CSV', errors: csvResult.errors, summary: csvResult.summary });
    }
    res.json({ success: true, recipients: csvResult.recipients, summary: csvResult.summary, errors: csvResult.errors, message: `${csvResult.recipients.length} email addresses extracted successfully` });
  } catch (err) {
    logger.error('CSV upload failed:', err);
    if (req.file) await fileUploadService.cleanupFile(req.file.path);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
