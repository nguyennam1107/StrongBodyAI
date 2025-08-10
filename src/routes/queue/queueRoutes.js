const express = require('express');
const router = express.Router();
const { getQueueService } = require('../../services/queueService');
const logger = require('../../utils/logger');

/**
 * @swagger
 * /api/email/queue/stats:
 *   get:
 *     summary: Thống kê queue
 *     tags: [Queue]
 */
router.get('/queue/stats', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    const stats = await queueService.getQueueStats();
    res.json({ success: true, queue: stats, timestamp: new Date().toISOString() });
  } catch (err) {
    logger.error('Get queue stats failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/job/{jobId}:
 *   get:
 *     summary: Kiểm tra trạng thái job
 *     tags: [Queue]
 */
router.get('/job/:jobId', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    const status = await queueService.getJobStatus(req.params.jobId);
    res.json({ success: true, job: status });
  } catch (err) {
    logger.error('Get job status failed:', err);
    res.status(404).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/job/{jobId}:
 *   delete:
 *     summary: Hủy job
 *     tags: [Queue]
 */
router.delete('/job/:jobId', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    await queueService.cancelJob(req.params.jobId);
    res.json({ success: true, message: `Job ${req.params.jobId} cancelled successfully` });
  } catch (err) {
    logger.error('Cancel job failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/queue/pause:
 *   post:
 *     summary: Tạm dừng queue
 *     tags: [Queue]
 */
router.post('/queue/pause', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    await queueService.pauseQueue();
    res.json({ success: true, message: 'Email queue paused' });
  } catch (err) {
    logger.error('Pause queue failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/queue/resume:
 *   post:
 *     summary: Tiếp tục queue
 *     tags: [Queue]
 */
router.post('/queue/resume', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    await queueService.resumeQueue();
    res.json({ success: true, message: 'Email queue resumed' });
  } catch (err) {
    logger.error('Resume queue failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * @swagger
 * /api/email/queue/clean:
 *   post:
 *     summary: Dọn dẹp queue
 *     tags: [Queue]
 */
router.post('/queue/clean', async (req, res) => {
  try {
    const queueService = getQueueService();
    if (!queueService) return res.status(503).json({ success: false, error: 'Queue service not available' });
    const olderThanHours = req.body.olderThanHours || 24;
    const result = await queueService.cleanQueue(olderThanHours * 60 * 60 * 1000);
    res.json({ success: true, cleaned: result, message: `Cleaned ${result.completed} completed and ${result.failed} failed jobs` });
  } catch (err) {
    logger.error('Clean queue failed:', err);
    res.status(500).json({ success: false, error: err.message });
  }
});

module.exports = router;
