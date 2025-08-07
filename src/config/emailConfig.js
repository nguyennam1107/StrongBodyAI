const nodemailer = require('nodemailer');
const logger = require('../utils/logger');

class EmailConfig {
  constructor() {
    this.accounts = [];
    this.currentAccountIndex = 0;
    this.dailyLimits = new Map(); // Track daily email counts per account
    this.loadEmailAccounts();
  }

  loadEmailAccounts() {
    const accountCount = parseInt(process.env.EMAIL_ACCOUNTS_COUNT) || 1;
    
    for (let i = 1; i <= accountCount; i++) {
      const email = process.env[`EMAIL_USER_${i}`];
      const password = process.env[`EMAIL_PASS_${i}`];
      
      if (email && password) {
        const transporter = nodemailer.createTransport({
          service: 'gmail',
          auth: {
            user: email,
            pass: password
          },
          pool: true, // Use connection pooling
          maxConnections: 5,
          maxMessages: 100,
          rateLimit: 5 // 5 emails per second max
        });

        this.accounts.push({
          id: i,
          email,
          transporter,
          dailyCount: 0,
          lastResetDate: new Date().toDateString()
        });

        logger.info(`✅ Email account configured: ${email}`);
      } else {
        logger.warn(`⚠️ Email account ${i} not configured properly`);
      }
    }

    if (this.accounts.length === 0) {
      logger.warn('⚠️ No email accounts configured. Email functionality will be limited.');
      logger.info('💡 To configure email accounts, set EMAIL_USER_1, EMAIL_PASS_1, etc. in your .env file');
    } else {
      logger.info(`📧 Total email accounts loaded: ${this.accounts.length}`);
    }
  }

  async verifyConnections() {
    const verificationPromises = this.accounts.map(async (account) => {
      try {
        await account.transporter.verify();
        logger.info(`✅ Email account verified: ${account.email}`);
        return { email: account.email, status: 'verified' };
      } catch (error) {
        logger.error(`❌ Email account verification failed: ${account.email}`, error);
        return { email: account.email, status: 'failed', error: error.message };
      }
    });

    return await Promise.all(verificationPromises);
  }

  getNextAvailableAccount() {
    if (this.accounts.length === 0) {
      throw new Error('No email accounts configured. Please configure email accounts in your .env file.');
    }

    const today = new Date().toDateString();
    const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT_PER_ACCOUNT) || 450;

    // Reset daily counts if it's a new day
    this.accounts.forEach(account => {
      if (account.lastResetDate !== today) {
        account.dailyCount = 0;
        account.lastResetDate = today;
      }
    });

    // Find an account that hasn't reached daily limit
    let attempts = 0;
    while (attempts < this.accounts.length) {
      const account = this.accounts[this.currentAccountIndex];
      
      if (account.dailyCount < dailyLimit) {
        return account;
      }

      // Move to next account
      this.currentAccountIndex = (this.currentAccountIndex + 1) % this.accounts.length;
      attempts++;
    }

    // All accounts have reached daily limit
    throw new Error('All email accounts have reached their daily sending limit');
  }

  incrementAccountUsage(accountId) {
    const account = this.accounts.find(acc => acc.id === accountId);
    if (account) {
      account.dailyCount++;
      logger.debug(`Account ${account.email} daily count: ${account.dailyCount}`);
    }
  }

  getAccountsStatus() {
    const today = new Date().toDateString();
    const dailyLimit = parseInt(process.env.DAILY_EMAIL_LIMIT_PER_ACCOUNT) || 450;

    return this.accounts.map(account => ({
      id: account.id,
      email: account.email,
      dailyCount: account.dailyCount,
      dailyLimit,
      remainingToday: dailyLimit - account.dailyCount,
      lastResetDate: account.lastResetDate,
      isAvailable: account.dailyCount < dailyLimit && account.lastResetDate === today
    }));
  }

  async closeConnections() {
    await Promise.all(
      this.accounts.map(account => account.transporter.close())
    );
    logger.info('All email connections closed');
  }
}

module.exports = new EmailConfig();
