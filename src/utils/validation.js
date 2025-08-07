const Joi = require('joi');

// Email validation schema
const emailSchema = Joi.object({
  email: Joi.string().email().required(),
  name: Joi.string().optional(),
  firstName: Joi.string().optional(),
  lastName: Joi.string().optional(),
  customData: Joi.object().optional()
});

// Single email request schema
const singleEmailSchema = Joi.object({
  to: Joi.string().email().required(),
  subject: Joi.string().required().max(998), // RFC 2822 limit
  html: Joi.string().optional(),
  text: Joi.string().optional(),
  senderName: Joi.string().optional().max(100),
  replyTo: Joi.string().email().optional(),
  cc: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email())
  ).optional(),
  bcc: Joi.alternatives().try(
    Joi.string().email(),
    Joi.array().items(Joi.string().email())
  ).optional(),
  attachments: Joi.array().items(
    Joi.object({
      filename: Joi.string().required(),
      path: Joi.string().optional(),
      content: Joi.string().optional(),
      contentType: Joi.string().optional()
    })
  ).optional()
}).custom((value, helpers) => {
  // At least one of html or text must be provided
  if (!value.html && !value.text) {
    return helpers.error('any.custom', {
      message: 'Either html or text content must be provided'
    });
  }
  return value;
});

// Bulk email request schema
const bulkEmailSchema = Joi.object({
  recipients: Joi.array().items(emailSchema).min(1).max(10000).required(),
  template: Joi.object({
    subject: Joi.string().required().max(998),
    html: Joi.string().optional(),
    text: Joi.string().optional()
  }).custom((value, helpers) => {
    if (!value.html && !value.text) {
      return helpers.error('any.custom', {
        message: 'Template must include either html or text content'
      });
    }
    return value;
  }).required(),
  options: Joi.object({
    senderName: Joi.string().optional().max(100),
    replyTo: Joi.string().email().optional(),
    priority: Joi.number().integer().min(0).max(10).optional(),
    delay: Joi.number().integer().min(0).optional(),
    attachments: Joi.array().items(
      Joi.object({
        filename: Joi.string().required(),
        path: Joi.string().optional(),
        content: Joi.string().optional(),
        contentType: Joi.string().optional()
      })
    ).optional()
  }).optional()
});

// Template validation schema
const templateSchema = Joi.object({
  name: Joi.string().required().max(100),
  subject: Joi.string().required().max(998),
  html: Joi.string().optional(),
  text: Joi.string().optional(),
  description: Joi.string().optional().max(500),
  variables: Joi.array().items(Joi.string()).optional()
}).custom((value, helpers) => {
  if (!value.html && !value.text) {
    return helpers.error('any.custom', {
      message: 'Template must include either html or text content'
    });
  }
  return value;
});

// CSV upload validation
const csvUploadSchema = Joi.object({
  emailColumn: Joi.string().required(),
  nameColumn: Joi.string().optional(),
  firstNameColumn: Joi.string().optional(),
  lastNameColumn: Joi.string().optional(),
  customColumns: Joi.array().items(Joi.string()).optional()
});

class ValidationService {
  validateSingleEmail(data) {
    return singleEmailSchema.validate(data, { abortEarly: false });
  }

  validateBulkEmail(data) {
    return bulkEmailSchema.validate(data, { abortEarly: false });
  }

  validateTemplate(data) {
    return templateSchema.validate(data, { abortEarly: false });
  }

  validateCsvUpload(data) {
    return csvUploadSchema.validate(data, { abortEarly: false });
  }

  validateEmail(email) {
    const schema = Joi.string().email();
    return schema.validate(email);
  }

  validateEmailList(emails) {
    const schema = Joi.array().items(Joi.string().email()).min(1);
    return schema.validate(emails);
  }

  // Custom validation for email content
  validateEmailContent(content) {
    const errors = [];

    // Check for potential spam indicators
    const spamIndicators = [
      'FREE!',
      'URGENT',
      'WINNER',
      'CLICK HERE NOW',
      'LIMITED TIME',
      'MAKE MONEY FAST',
      '100% GUARANTEED'
    ];

    const upperContent = content.toUpperCase();
    const foundSpamWords = spamIndicators.filter(word => 
      upperContent.includes(word)
    );

    if (foundSpamWords.length > 0) {
      errors.push({
        type: 'spam_warning',
        message: `Content contains potential spam words: ${foundSpamWords.join(', ')}`,
        words: foundSpamWords
      });
    }

    // Check content length
    if (content.length > 100000) { // 100KB
      errors.push({
        type: 'content_length',
        message: 'Email content is very large and may cause delivery issues',
        length: content.length
      });
    }

    // Check for excessive links
    const linkMatches = content.match(/https?:\/\/[^\s<>"]+/gi) || [];
    if (linkMatches.length > 10) {
      errors.push({
        type: 'excessive_links',
        message: 'Email contains many links which may trigger spam filters',
        linkCount: linkMatches.length
      });
    }

    return {
      valid: errors.length === 0,
      warnings: errors.filter(e => e.type === 'spam_warning'),
      errors: errors.filter(e => e.type !== 'spam_warning')
    };
  }

  // Sanitize email content
  sanitizeEmailContent(content) {
    if (!content) return content;

    // Remove potentially dangerous HTML tags
    const dangerousTags = /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi;
    content = content.replace(dangerousTags, '');

    // Remove iframe tags
    const iframeTags = /<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi;
    content = content.replace(iframeTags, '');

    // Remove form tags
    const formTags = /<form\b[^<]*(?:(?!<\/form>)<[^<]*)*<\/form>/gi;
    content = content.replace(formTags, '');

    return content;
  }
}

module.exports = new ValidationService();
