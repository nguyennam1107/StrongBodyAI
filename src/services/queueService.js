const emailService = require('./emailService');
const logger = require('../utils/logger');

class UnifiedQueueService {
  constructor() {
    this.jobs = new Map();
    this.jobCounter = 0;
    this.isProcessing = false;
    this.queue = [];
    this.completed = [];
    this.failed = [];
    this.maxHistory = 100;
    this.redisQueue = null; // Will be initialized if Redis is available
    
    this.initializeQueue();
  }

  async initializeQueue() {
    try {
      // Try to initialize Redis queue first
      if (process.env.REDIS_HOST || process.env.REDIS_PORT) {
        await this.initializeRedisQueue();
      } else {
        // Fallback to memory queue
        this.initializeMemoryQueue();
      }
    } catch (error) {
      logger.warn('⚠️ Redis queue initialization failed, falling back to memory queue:', error.message);
      this.initializeMemoryQueue();
    }
  }

  async initializeRedisQueue() {
    try {
      const Queue = require('bull');
      const Redis = require('redis');

      // Test Redis connection
      const redisClient = Redis.createClient({
        url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
        socket: {
          connectTimeout: 5000,
          lazyConnect: true
        }
      });

      await redisClient.connect();
      await redisClient.disconnect();

      // Initialize Bull queue
      this.redisQueue = new Queue('email sending', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
        defaultJobOptions: {
          removeOnComplete: 50,
          removeOnFail: 100,
          attempts: 3,
          backoff: 'exponential',
        }
      });

      // Process jobs
      this.redisQueue.process('single-email', async (job) => {
        const { emailData } = job.data;
        return await emailService.sendSingleEmail(emailData);
      });

      this.redisQueue.process('bulk-email', 1, async (job) => {
        const { recipients, template, options } = job.data;
        job.progress(0);
        
        const result = await this.processBulkEmailWithProgress(
          job, recipients, template, options
        );
        
        job.progress(100);
        return result;
      });

      // Event listeners
      this.redisQueue.on('completed', (job, result) => {
        logger.info(`✅ Redis job ${job.id} completed successfully`);
      });

      this.redisQueue.on('failed', (job, err) => {
        logger.error(`❌ Redis job ${job.id} failed:`, err);
      });

      logger.info('✅ Redis queue initialized successfully');
      return true;

    } catch (error) {
      logger.error('❌ Redis queue initialization failed:', error);
      throw error;
    }
  }

  initializeMemoryQueue() {
    logger.info('✅ Memory queue initialized');
    this.startMemoryQueueProcessing();
  }

  async startMemoryQueueProcessing() {
    if (this.isProcessing) return;
    
    this.isProcessing = true;
    logger.info('📋 Memory queue processor started');

    while (this.isProcessing) {
      try {
        if (this.queue.length === 0) {
          await this.sleep(1000);
          continue;
        }

        const job = this.queue.shift();
        if (!job || job.state !== 'waiting') {
          continue;
        }

        await this.processMemoryJob(job);

      } catch (error) {
        logger.error('Memory queue processing error:', error);
        await this.sleep(5000);
      }
    }
  }

  async processMemoryJob(job) {
    try {
      job.state = 'active';
      job.processedAt = new Date();
      job.attempts++;
      
      logger.info(`🔄 Processing memory job ${job.id} (${job.type})`);

      let result;
      
      if (job.type === 'single-email') {
        const { emailData } = job.data;
        result = await emailService.sendSingleEmail(emailData);
      } else if (job.type === 'bulk-email') {
        const { recipients, template, options } = job.data;
        job.progress = 0;
        result = await this.processBulkEmailWithProgress(job, recipients, template, options);
      }

      job.state = 'completed';
      job.progress = 100;
      job.result = result;
      job.finishedAt = new Date();
      
      this.completed.unshift(job);
      if (this.completed.length > this.maxHistory) {
        this.completed.pop();
      }

      logger.info(`✅ Memory job ${job.id} completed successfully`);

    } catch (error) {
      logger.error(`❌ Memory job ${job.id} failed:`, error);
      
      if (job.attempts < job.maxAttempts) {
        job.state = 'waiting';
        this.queue.push(job);
        logger.info(`🔄 Retrying memory job ${job.id} (attempt ${job.attempts}/${job.maxAttempts})`);
      } else {
        job.state = 'failed';
        job.result = { error: error.message };
        job.finishedAt = new Date();
        
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
        const progress = Math.round(((i + 1) / recipients.length) * 100);
        if (job.progress) {
          job.progress(progress); // Redis queue
        } else {
          job.progress = progress; // Memory queue
        }

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

  // Unified API methods
  async addSingleEmailJob(emailData, options = {}) {
    if (this.redisQueue) {
      // Use Redis queue
      const job = await this.redisQueue.add('single-email', {
        emailData
      }, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        ...options
      });

      logger.info(`📝 Single email job added to Redis queue: ${job.id}`);
      return { id: job.id.toString() };
    } else {
      // Use memory queue
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
      this.queue.sort((a, b) => b.priority - a.priority);
      
      logger.info(`📝 Single email job added to memory queue: ${jobId}`);
      return { id: jobId.toString() };
    }
  }

  async addBulkEmailJob(recipients, template, options = {}) {
    if (this.redisQueue) {
      // Use Redis queue
      const job = await this.redisQueue.add('bulk-email', {
        recipients,
        template,
        options
      }, {
        priority: options.priority || 0,
        delay: options.delay || 0,
        ...options
      });

      logger.info(`📝 Bulk email job added to Redis queue: ${job.id} (${recipients.length} recipients)`);
      return { id: job.id.toString() };
    } else {
      // Use memory queue
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
      this.queue.sort((a, b) => b.priority - a.priority);
      
      logger.info(`📝 Bulk email job added to memory queue: ${jobId} (${recipients.length} recipients)`);
      return { id: jobId.toString() };
    }
  }

  async getJobStatus(jobId) {
    if (this.redisQueue) {
      // Redis queue
      const job = await this.redisQueue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      const state = await job.getState();
      const progress = job.progress();

      return {
        id: jobId,
        state,
        progress,
        result: job.returnvalue,
        createdAt: new Date(job.timestamp),
        processedAt: job.processedOn ? new Date(job.processedOn) : null,
        finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
        attempts: job.attemptsMade,
        maxAttempts: job.opts.attempts
      };
    } else {
      // Memory queue
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
  }

  async getQueueStats() {
    if (this.redisQueue) {
      // Redis queue stats
      const waiting = await this.redisQueue.getWaiting();
      const active = await this.redisQueue.getActive();
      const completed = await this.redisQueue.getCompleted();
      const failed = await this.redisQueue.getFailed();

      return {
        waiting: waiting.length,
        active: active.length,
        completed: completed.length,
        failed: failed.length,
        total: waiting.length + active.length + completed.length + failed.length,
        type: 'redis'
      };
    } else {
      // Memory queue stats
      const waiting = this.queue.filter(job => job.state === 'waiting').length;
      const active = this.queue.filter(job => job.state === 'active').length;

      return {
        waiting,
        active,
        completed: this.completed.length,
        failed: this.failed.length,
        total: waiting + active + this.completed.length + this.failed.length,
        type: 'memory'
      };
    }
  }

  async cancelJob(jobId) {
    if (this.redisQueue) {
      // Redis queue
      const job = await this.redisQueue.getJob(jobId);
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      await job.remove();
      logger.info(`🗑️ Redis job ${jobId} cancelled`);
      return true;
    } else {
      // Memory queue
      const job = this.jobs.get(parseInt(jobId));
      if (!job) {
        throw new Error(`Job ${jobId} not found`);
      }

      if (job.state === 'waiting') {
        const index = this.queue.findIndex(j => j.id === job.id);
        if (index > -1) {
          this.queue.splice(index, 1);
        }
        
        job.state = 'failed';
        job.result = { error: 'Job cancelled' };
        this.jobs.delete(job.id);
        
        logger.info(`🗑️ Memory job ${jobId} cancelled`);
        return true;
      } else {
        throw new Error(`Cannot cancel job ${jobId} in state ${job.state}`);
      }
    }
  }

  async pauseQueue() {
    if (this.redisQueue) {
      await this.redisQueue.pause();
      logger.info('⏸️ Redis queue paused');
    } else {
      this.isProcessing = false;
      logger.info('⏸️ Memory queue paused');
    }
  }

  async resumeQueue() {
    if (this.redisQueue) {
      await this.redisQueue.resume();
      logger.info('▶️ Redis queue resumed');
    } else {
      if (!this.isProcessing) {
        this.startMemoryQueueProcessing();
        logger.info('▶️ Memory queue resumed');
      }
    }
  }

  async cleanQueue(olderThanMs = 24 * 60 * 60 * 1000) {
    if (this.redisQueue) {
      const completed = await this.redisQueue.clean(olderThanMs, 'completed');
      const failed = await this.redisQueue.clean(olderThanMs, 'failed');
      
      logger.info(`🧹 Redis queue cleaned: ${completed} completed, ${failed} failed jobs`);
      return { completed, failed };
    } else {
      const cutoff = Date.now() - olderThanMs;
      
      const initialCompletedCount = this.completed.length;
      const initialFailedCount = this.failed.length;
      
      this.completed = this.completed.filter(job => job.finishedAt.getTime() > cutoff);
      this.failed = this.failed.filter(job => job.finishedAt.getTime() > cutoff);
      
      const cleanedCompleted = initialCompletedCount - this.completed.length;
      const cleanedFailed = initialFailedCount - this.failed.length;
      
      logger.info(`🧹 Memory queue cleaned: ${cleanedCompleted} completed, ${cleanedFailed} failed jobs`);
      return { completed: cleanedCompleted, failed: cleanedFailed };
    }
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  getQueueType() {
    return this.redisQueue ? 'redis' : 'memory';
  }
}

// Global unified queue instance
let queueService;

async function initializeQueueService() {
  try {
    queueService = new UnifiedQueueService();
    logger.info('✅ Unified queue service initialized successfully');
    return queueService;
  } catch (error) {
    logger.error('❌ Failed to initialize unified queue service:', error);
    throw error;
  }
}

module.exports = {
  initializeQueueService,
  getQueueService: () => queueService
};
