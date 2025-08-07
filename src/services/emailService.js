const emailConfig = require('../config/emailConfig');
const logger = require('../utils/logger');
const { compileTemplate } = require('../utils/templateEngine');

class EmailService {
  constructor() {
    this.sendDelay = parseInt(process.env.EMAIL_SEND_DELAY) || 1000;
  }

  async sendSingleEmail(emailData) {
    try {
      const account = emailConfig.getNextAvailableAccount();
      
      const mailOptions = {
        from: `"${emailData.senderName || 'Bulk Email Sender'}" <${account.email}>`,
        to: emailData.to,
        subject: emailData.subject,
        html: emailData.html || emailData.text,
        text: emailData.text,
        attachments: emailData.attachments || []
      };

      // Add reply-to if specified
      if (emailData.replyTo) {
        mailOptions.replyTo = emailData.replyTo;
      }

      // Add CC and BCC if specified
      if (emailData.cc) mailOptions.cc = emailData.cc;
      if (emailData.bcc) mailOptions.bcc = emailData.bcc;

      const info = await account.transporter.sendMail(mailOptions);
      
      // Increment account usage
      emailConfig.incrementAccountUsage(account.id);
      
      logger.info(`📧 Email sent successfully to ${emailData.to} via ${account.email}`);
      
      return {
        success: true,
        messageId: info.messageId,
        recipient: emailData.to,
        senderAccount: account.email,
        timestamp: new Date().toISOString()
      };
    } catch (error) {
      logger.error(`❌ Failed to send email to ${emailData.to}:`, error);
      return {
        success: false,
        recipient: emailData.to,
        error: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  async sendBulkEmails(recipients, emailTemplate, options = {}) {
    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      details: []
    };

    logger.info(`🚀 Starting bulk email send to ${recipients.length} recipients`);

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Compile template with recipient data
        const personalizedEmail = await this.personalizeEmail(emailTemplate, recipient);
        
        // Send email
        const result = await this.sendSingleEmail({
          to: recipient.email,
          subject: personalizedEmail.subject,
          html: personalizedEmail.html,
          text: personalizedEmail.text,
          senderName: options.senderName,
          replyTo: options.replyTo,
          attachments: options.attachments
        });

        if (result.success) {
          results.successful++;
        } else {
          results.failed++;
        }

        results.details.push(result);

        // Add delay between emails to avoid spam filters
        if (i < recipients.length - 1) {
          await this.delay(this.sendDelay);
        }

        // Log progress
        if ((i + 1) % 10 === 0) {
          logger.info(`📊 Progress: ${i + 1}/${recipients.length} emails processed`);
        }

      } catch (error) {
        logger.error(`❌ Error processing recipient ${recipient.email}:`, error);
        results.failed++;
        results.details.push({
          success: false,
          recipient: recipient.email,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    logger.info(`✅ Bulk email completed: ${results.successful} successful, ${results.failed} failed`);
    return results;
  }

  async personalizeEmail(template, recipientData) {
    try {
      // Compile subject
      const subject = await compileTemplate(template.subject, recipientData);
      
      // Compile HTML content
      let html = template.html;
      if (html) {
        html = await compileTemplate(html, recipientData);
      }

      // Compile text content
      let text = template.text;
      if (text) {
        text = await compileTemplate(text, recipientData);
      }

      return { subject, html, text };
    } catch (error) {
      logger.error('Error personalizing email template:', error);
      throw error;
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async testEmailConnection() {
    try {
      const verificationResults = await emailConfig.verifyConnections();
      return {
        success: true,
        accounts: verificationResults,
        totalAccounts: emailConfig.accounts.length
      };
    } catch (error) {
      logger.error('Email connection test failed:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  getEmailAccountsStatus() {
    return emailConfig.getAccountsStatus();
  }
}

module.exports = new EmailService();
