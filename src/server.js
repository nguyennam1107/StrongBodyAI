const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
require('dotenv').config();

console.log('📦 Loading modules...');

const logger = require('./utils/logger');

console.log('🔧 Logger loaded');

const unifiedEmailRoutes = require('./routes/unifiedEmailRoutes');

console.log('🛣️ Unified routes loaded');

// Lazy load queue để tránh startup blocking
let initializeQueueService;

console.log('📋 Unified queue service configured');

// Swagger documentation
const { specs, swaggerUi, swaggerOptions } = require('./config/swagger');

console.log('📚 Swagger loaded');

const app = express();
const PORT = process.env.PORT || 3000;

console.log('⚙️ Setting up middleware...');

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100,
  message: {
    error: 'Too many requests from this IP, please try again later.',
  },
});
app.use('/api/', limiter);

// Static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Swagger UI Documentation
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(specs, swaggerOptions));

// Routes
app.use('/api/email', unifiedEmailRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    docs: `${req.protocol}://${req.get('host')}/api-docs`,
    endpoints: {
      health: `${req.protocol}://${req.get('host')}/health`,
      emailHealth: `${req.protocol}://${req.get('host')}/api/email/health`,
      swagger: `${req.protocol}://${req.get('host')}/api-docs`
    }
  });
});

// Redirect root to Swagger UI
app.get('/', (req, res) => {
  res.redirect('/api-docs');
});

// Error handling middleware
app.use((err, req, res, next) => {
  logger.error('Error:', err);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Initialize email queue and start server
async function startServer() {
  try {
    console.log('🚀 Starting bulk email server...');
    
    console.log('📧 Initializing unified queue service...');
    // Lazy load queue để tránh startup blocking
    if (!initializeQueueService) {
      console.log('📦 Loading unified queue service...');
      const queueModule = require('./services/queueService');
      initializeQueueService = queueModule.initializeQueueService;
    }
    
    await initializeQueueService();
    logger.info('Unified queue service initialized successfully');
    
    console.log('🌐 Starting Express server...');
    const server = app.listen(PORT, () => {
      logger.info(`🚀 Server running on port ${PORT}`);
      logger.info(`📧 Email API available at http://localhost:${PORT}/api/email`);
      logger.info(`💚 Health check at http://localhost:${PORT}/health`);
      console.log(`✅ Server successfully started on port ${PORT}`);
    });

    server.on('error', (error) => {
      logger.error('Server error:', error);
      console.error('❌ Server error:', error);
      process.exit(1);
    });

  } catch (error) {
    logger.error('Failed to start server:', error);
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

startServer();
