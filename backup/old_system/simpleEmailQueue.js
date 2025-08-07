const emailService = require('./emailService');
const logger = require('../utils/logger');

class SimpleEmailQueue {
  constructor() {
    this.jobs = new Map();
    this.jobCounter = 0;
    this.isProcessing = false;
    this.queue = [];
    this.completed = [];
    this.failed = [];
    this.maxHistory = 100; // Keep last 100 jobs in memory
    
    // Start processing queue
    this.startProcessing();
  }

  // Add single email job
  async addSingleEmailJob(emailData, options = {}) {
    const jobId = ++this.jobCounter;
    const job = {
      id: jobId,
      type: 'single-email',
      data: { emailData },
      state: 'waiting',
      progress: 0,
      createdAt: new Date(),
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: 3
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);
    
    // Sort by priority (higher priority first)
    this.queue.sort((a, b) => b.priority - a.priority);
    
    logger.info(`📝 Single email job added to queue: ${jobId}`);
    return { id: jobId };
  }

  // Add bulk email job
  async addBulkEmailJob(recipients, template, options = {}) {
    const jobId = ++this.jobCounter;
    const job = {
      id: jobId,
      type: 'bulk-email',
      data: { recipients, template, options },
      state: 'waiting',
      progress: 0,
      createdAt: new Date(),
      priority: options.priority || 0,
      attempts: 0,
      maxAttempts: 3
    };

    this.jobs.set(jobId, job);
    this.queue.push(job);
    
    // Sort by priority
    this.queue.sort((a, b) => b.priority - a.priority);
    
    logger.info(`📝 Bulk email job added to queue: ${jobId} (${recipients.length} recipients)`);
    return { id: jobId };
  }

  // Get job status
  async getJobStatus(jobId) {
    const job = this.jobs.get(parseInt(jobId));
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    return {
      id: jobId,
      state: job.state,
      progress: job.progress,
      result: job.result,
      createdAt: job.createdAt,
      processedAt: job.processedAt,
      finishedAt: job.finishedAt,
      attempts: job.attempts,
      maxAttempts: job.maxAttempts
    };
  }

  // Get queue statistics
  async getQueueStats() {
    const waiting = this.queue.filter(job => job.state === 'waiting').length;
    const active = this.queue.filter(job => job.state === 'active').length;
    const completed = this.completed.length;
    const failed = this.failed.length;

    return {
      waiting,
      active,
      completed,
      failed,
      total: waiting + active + completed + failed
    };
  }

  // Cancel job
  async cancelJob(jobId) {
    const job = this.jobs.get(parseInt(jobId));
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    if (job.state === 'waiting') {
      // Remove from queue
      const index = this.queue.findIndex(j => j.id === job.id);
      if (index > -1) {
        this.queue.splice(index, 1);
      }
      
      job.state = 'failed';
      job.result = { error: 'Job cancelled' };
      this.jobs.delete(job.id);
      
      logger.info(`🗑️ Job ${jobId} cancelled and removed from queue`);
      return true;
    } else {
      throw new Error(`Cannot cancel job ${jobId} in state ${job.state}`);
    }
  }

  // Process queue
  async startProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    logger.info('📋 Queue processor started');

    while (this.isProcessing) {
      try {
        if (this.queue.length === 0) {
          // No jobs, wait a bit
          await this.sleep(1000);
          continue;
        }

        // Get next job
        const job = this.queue.shift();
        if (!job || job.state !== 'waiting') {
          continue;
        }

        // Process job
        await this.processJob(job);

      } catch (error) {
        logger.error('Queue processing error:', error);
        await this.sleep(5000); // Wait 5 seconds on error
      }
    }
  }

  async processJob(job) {
    try {
      job.state = 'active';
      job.processedAt = new Date();
      job.attempts++;
      
      logger.info(`🔄 Processing job ${job.id} (${job.type})`);

      let result;
      
      if (job.type === 'single-email') {
        const { emailData } = job.data;
        result = await emailService.sendSingleEmail(emailData);
      } else if (job.type === 'bulk-email') {
        const { recipients, template, options } = job.data;
        
        // Update progress for bulk emails
        job.progress = 0;
        
        // Process bulk emails with progress updates
        result = await this.processBulkEmailWithProgress(job, recipients, template, options);
      }

      // Job completed successfully
      job.state = 'completed';
      job.progress = 100;
      job.result = result;
      job.finishedAt = new Date();
      
      // Move to completed list
      this.completed.unshift(job);
      if (this.completed.length > this.maxHistory) {
        this.completed.pop();
      }

      logger.info(`✅ Job ${job.id} completed successfully`);

    } catch (error) {
      logger.error(`❌ Job ${job.id} failed:`, error);
      
      if (job.attempts < job.maxAttempts) {
        // Retry job
        job.state = 'waiting';
        this.queue.push(job);
        logger.info(`🔄 Retrying job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        // Job failed permanently
        job.state = 'failed';
        job.result = { error: error.message };
        job.finishedAt = new Date();
        
        // Move to failed list
        this.failed.unshift(job);
        if (this.failed.length > this.maxHistory) {
          this.failed.pop();
        }
      }
    }
  }

  async processBulkEmailWithProgress(job, recipients, template, options) {
    const results = {
      total: recipients.length,
      successful: 0,
      failed: 0,
      details: []
    };

    for (let i = 0; i < recipients.length; i++) {
      const recipient = recipients[i];
      
      try {
        // Personalize and send email
        const personalizedEmail = await emailService.personalizeEmail(template, recipient);
        
        const result = await emailService.sendSingleEmail({
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

        // Update progress
        job.progress = Math.round(((i + 1) / recipients.length) * 100);

        // Add delay between emails
        if (i < recipients.length - 1) {
          await this.sleep(1000);
        }

      } catch (error) {
        results.failed++;
        results.details.push({
          success: false,
          recipient: recipient.email,
          error: error.message,
          timestamp: new Date().toISOString()
        });
      }
    }

    return results;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // Pause processing
  pauseQueue() {
    this.isProcessing = false;
    logger.info('⏸️ Email queue paused');
  }

  // Resume processing
  resumeQueue() {
    if (!this.isProcessing) {
      this.startProcessing();
      logger.info('▶️ Email queue resumed');
    }
  }

  // Clean old completed/failed jobs
  cleanQueue(olderThanMs = 24 * 60 * 60 * 1000) {
    const cutoff = Date.now() - olderThanMs;
    
    const initialCompletedCount = this.completed.length;
    const initialFailedCount = this.failed.length;
    
    this.completed = this.completed.filter(job => job.finishedAt.getTime() > cutoff);
    this.failed = this.failed.filter(job => job.finishedAt.getTime() > cutoff);
    
    const cleanedCompleted = initialCompletedCount - this.completed.length;
    const cleanedFailed = initialFailedCount - this.failed.length;
    
    logger.info(`🧹 Queue cleaned: ${cleanedCompleted} completed jobs, ${cleanedFailed} failed jobs removed`);
    
    return { completed: cleanedCompleted, failed: cleanedFailed };
  }
}

// Global queue instance
let emailQueue;

async function initializeEmailQueue() {
  try {
    emailQueue = new SimpleEmailQueue();
    logger.info('✅ Simple email queue initialized successfully');
  } catch (error) {
    logger.error('❌ Failed to initialize email queue:', error);
    throw error;
  }
}

// Export queue service
const emailQueueService = {
  async addSingleEmailJob(emailData, options = {}) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return await emailQueue.addSingleEmailJob(emailData, options);
  },

  async addBulkEmailJob(recipients, template, options = {}) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return await emailQueue.addBulkEmailJob(recipients, template, options);
  },

  async getJobStatus(jobId) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return await emailQueue.getJobStatus(jobId);
  },

  async getQueueStats() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return await emailQueue.getQueueStats();
  },

  async cancelJob(jobId) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return await emailQueue.cancelJob(jobId);
  },

  async pauseQueue() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    emailQueue.pauseQueue();
  },

  async resumeQueue() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    emailQueue.resumeQueue();
  },

  async cleanQueue(olderThanMs) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }
    return emailQueue.cleanQueue(olderThanMs);
  }
};

module.exports = {
  initializeEmailQueue,
  emailQueueService
};
