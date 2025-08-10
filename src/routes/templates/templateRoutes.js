const express = require('express');
const router = express.Router();
const { predefinedTemplates, validateTemplate, extractVariables } = require('../../utils/templateEngine');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/templates:
 *   get:
 *     summary: Danh sách template có sẵn
 *     tags: [Templates]
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
 *     tags: [Templates]
 */
router.post('/templates/validate', (req, res) => {
  try {
    const { template } = req.body;
    if (!template) return res.status(400).json({ error: 'Template is required' });
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
