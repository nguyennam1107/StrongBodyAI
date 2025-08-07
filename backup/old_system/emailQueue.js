const Queue = require('bull');
const Redis = require('redis');
const emailService = require('./emailService');
const logger = require('../utils/logger');

let emailQueue;
let redisClient;

// Initialize Redis connection
async function initializeRedis() {
  try {
    // Skip Redis if not configured
    if (!process.env.REDIS_HOST && !process.env.REDIS_PORT) {
      logger.info('ℹ️ Redis not configured, using memory queue');
      return false;
    }

    redisClient = Redis.createClient({
      url: `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || 6379}`,
      socket: {
        connectTimeout: 5000,
        lazyConnect: true
      }
    });

    await redisClient.connect();
    logger.info('✅ Redis connected successfully');
    return true;
  } catch (error) {
    logger.warn('⚠️ Redis connection failed, falling back to memory queue:', error.message);
    return false;
  }
}

async function initializeEmailQueue() {
  const redisConnected = await initializeRedis();
  
  try {
    if (redisConnected) {
      // Use Redis for persistent queue
      emailQueue = new Queue('email sending', {
        redis: {
          host: process.env.REDIS_HOST || 'localhost',
          port: process.env.REDIS_PORT || 6379,
        },
        defaultJobOptions: {
          removeOnComplete: 50, // Keep last 50 completed jobs
          removeOnFail: 100,    // Keep last 100 failed jobs
          attempts: 3,          // Retry failed jobs 3 times
          backoff: 'exponential', // Exponential backoff for retries
        }
      });

      logger.info('✅ Email queue initialized with Redis backend');
    } else {
      // Fallback to memory queue (not persistent)
      emailQueue = new Queue('email sending');
      logger.info('✅ Email queue initialized with memory backend');
    }

    // Process jobs
    emailQueue.process('single-email', async (job) => {
      const { emailData } = job.data;
      return await emailService.sendSingleEmail(emailData);
    });

    emailQueue.process('bulk-email', 1, async (job) => {
      const { recipients, template, options } = job.data;
      
      // Update job progress
      job.progress(0);
      
      const results = await emailService.sendBulkEmails(recipients, template, options);
      
      job.progress(100);
      return results;
    });

    // Event listeners
    emailQueue.on('completed', (job, result) => {
      logger.info(`✅ Job ${job.id} completed successfully`);
    });

    emailQueue.on('failed', (job, err) => {
      logger.error(`❌ Job ${job.id} failed:`, err);
    });

    emailQueue.on('progress', (job, progress) => {
      logger.debug(`📊 Job ${job.id} progress: ${progress}%`);
    });

  } catch (error) {
    logger.error('❌ Failed to initialize email queue:', error);
    throw error;
  }
}

class EmailQueueService {
  async addSingleEmailJob(emailData, options = {}) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const job = await emailQueue.add('single-email', {
      emailData
    }, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    logger.info(`📝 Single email job added to queue: ${job.id}`);
    return job;
  }

  async addBulkEmailJob(recipients, template, options = {}) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const job = await emailQueue.add('bulk-email', {
      recipients,
      template,
      options
    }, {
      priority: options.priority || 0,
      delay: options.delay || 0,
      ...options
    });

    logger.info(`📝 Bulk email job added to queue: ${job.id} (${recipients.length} recipients)`);
    return job;
  }

  async getJobStatus(jobId) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const job = await emailQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    const state = await job.getState();
    const progress = job.progress();
    const result = job.returnvalue;

    return {
      id: jobId,
      state,
      progress,
      result,
      createdAt: new Date(job.timestamp),
      processedAt: job.processedOn ? new Date(job.processedOn) : null,
      finishedAt: job.finishedOn ? new Date(job.finishedOn) : null,
      attempts: job.attemptsMade,
      maxAttempts: job.opts.attempts
    };
  }

  async getQueueStats() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const waiting = await emailQueue.getWaiting();
    const active = await emailQueue.getActive();
    const completed = await emailQueue.getCompleted();
    const failed = await emailQueue.getFailed();

    return {
      waiting: waiting.length,
      active: active.length,
      completed: completed.length,
      failed: failed.length,
      total: waiting.length + active.length + completed.length + failed.length
    };
  }

  async cancelJob(jobId) {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const job = await emailQueue.getJob(jobId);
    if (!job) {
      throw new Error(`Job ${jobId} not found`);
    }

    await job.remove();
    logger.info(`🗑️ Job ${jobId} cancelled and removed from queue`);
    return true;
  }

  async pauseQueue() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    await emailQueue.pause();
    logger.info('⏸️ Email queue paused');
  }

  async resumeQueue() {
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    await emailQueue.resume();
    logger.info('▶️ Email queue resumed');
  }

  async cleanQueue(olderThan = 24 * 60 * 60 * 1000) { // 24 hours default
    if (!emailQueue) {
      throw new Error('Email queue not initialized');
    }

    const completed = await emailQueue.clean(olderThan, 'completed');
    const failed = await emailQueue.clean(olderThan, 'failed');
    
    logger.info(`🧹 Queue cleaned: ${completed} completed jobs, ${failed} failed jobs removed`);
    return { completed, failed };
  }
}

module.exports = {
  initializeEmailQueue,
  emailQueueService: new EmailQueueService()
};
