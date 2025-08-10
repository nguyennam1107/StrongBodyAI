const express = require('express');
const router = express.Router();
const { predefinedTemplates, validateTemplate, extractVariables } = require('../../utils/templateEngine');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/templates:
 *   get:
 *     summary: Danh sách template có sẵn
 *     description: Trả về danh sách template định nghĩa sẵn và các biến có thể sử dụng.
 *     tags: [Templates]
 *     responses:
 *       200:
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 templates:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: string
 *                       name:
 *                         type: string
 *                       subject:
 *                         type: string
 *                       html:
 *                         type: string
 *                       text:
 *                         type: string
 *                       variables:
 *                         type: array
 *                         items:
 *                           type: string
 */
router.get('/templates', (req, res) => {
  try {
    const templates = Object.keys(predefinedTemplates).map(key => ({
      id: key,
      name: key,
      ...predefinedTemplates[key],
      variables: extractVariables(predefinedTemplates[key].subject + ' ' + (predefinedTemplates[key].html || predefinedTemplates[key].text))
    }));
    res.json({ success: true, templates });
  } catch (err) {
    logger.error('Get templates failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/templates/validate:
 *   post:
 *     summary: Validate email template
 *     description: Kiểm tra tính hợp lệ và trích xuất biến từ template.
 *     tags: [Templates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [template]
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
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 validation:
 *                   type: object
 *                   properties:
 *                     subject:
 *                       type: object
 *                       properties:
 *                         valid:
 *                           type: boolean
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: string
 *                     html:
 *                       type: object
 *                       properties:
 *                         valid:
 *                           type: boolean
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: string
 *                     text:
 *                       type: object
 *                       properties:
 *                         valid:
 *                           type: boolean
 *                         errors:
 *                           type: array
 *                           items:
 *                             type: string
 *                     overall:
 *                       type: boolean
 *                 variables:
 *                   type: array
 *                   items:
 *                     type: string
 *       400:
 *         description: Thiếu template
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 error:
 *                   type: string
 */
router.post('/templates/validate', (req, res) => {
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ success: false, error: 'Template is required' });
    const subjectValidation = validateTemplate(template.subject || '');
    const htmlValidation = template.html ? validateTemplate(template.html) : { valid: true };
    const textValidation = template.text ? validateTemplate(template.text) : { valid: true };
    const variables = extractVariables((template.subject || '') + ' ' + (template.html || '') + ' ' + (template.text || ''));
    res.json({ success: true, validation: { subject: subjectValidation, html: htmlValidation, text: textValidation, overall: subjectValidation.valid && htmlValidation.valid && textValidation.valid }, variables });
  } catch (err) {
    logger.error('Template validation failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
