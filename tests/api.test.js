const request = require('supertest');
const app = require('../src/server');

describe('Email API', () => {
  describe('GET /health', () => {
    it('should return 200 and status OK', async () => {
      const res = await request(app)
        .get('/health')
        .expect(200);
      
      expect(res.body.status).toBe('OK');
      expect(res.body.timestamp).toBeDefined();
    });
  });

  describe('GET /api/email/health', () => {
    it('should return email service health status', async () => {
      const res = await request(app)
        .get('/api/email/health')
        .expect(200);
      
      expect(res.body.status).toBe('OK');
      expect(res.body.emailConnections).toBeDefined();
      expect(res.body.accounts).toBeDefined();
    });
  });

  describe('GET /api/email/templates', () => {
    it('should return predefined templates', async () => {
      const res = await request(app)
        .get('/api/email/templates')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.templates).toBeInstanceOf(Array);
      expect(res.body.templates.length).toBeGreaterThan(0);
    });
  });

  describe('POST /api/email/templates/validate', () => {
    it('should validate a correct template', async () => {
      const template = {
        subject: 'Hello {{name}}!',
        html: '<p>Hello {{name}}!</p>',
        text: 'Hello {{name}}!'
      };

      const res = await request(app)
        .post('/api/email/templates/validate')
        .send({ template })
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.validation.overall).toBe(true);
      expect(res.body.variables).toContain('name');
    });

    it('should reject invalid template', async () => {
      const template = {
        subject: 'Hello {{name}!', // Missing closing brace
        html: '<p>Hello {{name}}!</p>'
      };

      const res = await request(app)
        .post('/api/email/templates/validate')
        .send({ template })
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.validation.overall).toBe(false);
    });
  });

  describe('GET /api/email/accounts', () => {
    it('should return email accounts status', async () => {
      const res = await request(app)
        .get('/api/email/accounts')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.accounts).toBeInstanceOf(Array);
      expect(res.body.totalAccounts).toBeDefined();
    });
  });

  describe('GET /api/email/queue/stats', () => {
    it('should return queue statistics', async () => {
      const res = await request(app)
        .get('/api/email/queue/stats')
        .expect(200);
      
      expect(res.body.success).toBe(true);
      expect(res.body.queue).toBeDefined();
      expect(res.body.queue.waiting).toBeDefined();
      expect(res.body.queue.active).toBeDefined();
      expect(res.body.queue.completed).toBeDefined();
      expect(res.body.queue.failed).toBeDefined();
    });
  });
});
