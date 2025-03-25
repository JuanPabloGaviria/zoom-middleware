import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import crypto from 'crypto';
import config from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import webhookRoutes from './routes/webhookRoutes';
import testRoutes from './routes/testRoutes';

// Create Express application
const app = express();

// Add request logging middleware
app.use(function(req, res, next) {
  logger.info(`${req.method} ${req.url}`, {
    headers: {
      'content-type': req.headers['content-type'],
      'user-agent': req.headers['user-agent']
    }
  });
  next();
});

// Configure middleware BEFORE routes
// Middleware for parsing JSON and URL-encoded data
// Set higher limits since Zoom webhook payloads can be large
app.use(bodyParser.json({ 
  limit: '10mb',
  verify: function(req: any, res, buf) {
    // Store raw body for signature verification
    req.rawBody = buf;
  }
}));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use(cors());

// Basic route
app.get('/', function(req, res) {
  res.json({
    message: 'Zoom-ClickUp Integration API',
    status: 'Running',
    documentation: 'Visit /docs for API documentation'
  });
});

// Documentation route
app.get('/docs', function(req, res) {
  res.json({
    message: 'API Documentation',
    endpoints: {
      '/': 'Status check endpoint',
      '/webhook/zoom': 'Zoom webhook endpoint (POST)',
      '/webhook/zoom/validate': 'Special endpoint for Zoom validation (POST)',
      '/webhook/zoom/direct': 'Direct webhook processing without middleware (POST)',
      '/api/test-audio': 'Test endpoint for audio processing (POST)'
    },
    webhookSetup: 'Use https://your-domain.com/webhook/zoom as your Zoom webhook URL'
  });
});

// Mount route handlers
app.use('/webhook', webhookRoutes);
app.use('/api', testRoutes);

// Simple Zoom validation endpoint at the root level for testing
app.post('/zoom-validate', function(req, res) {
  logger.info('Received validation request to /zoom-validate', { body: req.body });
  
  try {
    if (req.body && req.body.payload && req.body.payload.plainToken) {
      const plainToken = req.body.payload.plainToken;
      const verificationToken = process.env.ZOOM_VERIFICATION_TOKEN || '';
      logger.info('Using verification token', { tokenPrefix: verificationToken.substring(0, 5) + '...' });
      
      const hashAlgorithm = crypto.createHmac('sha256', verificationToken);
      const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
      
      logger.info('Validation response from root endpoint', { plainToken, encryptedToken });
      
      res.status(200).json({
        plainToken,
        encryptedToken
      });
    } else {
      logger.warn('Invalid validation request format', { body: req.body });
      res.status(400).json({ error: 'Invalid request format' });
    }
  } catch (error) {
    logger.error('Error in root validation endpoint', { error });
    res.status(500).json({ error: 'Validation processing failed' });
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, function() {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API Base URL: http://localhost:${PORT}`);
  logger.info(`Zoom webhook URL: http://localhost:${PORT}/webhook/zoom`);
  logger.info(`Zoom direct validation URL: http://localhost:${PORT}/zoom-validate`);
});

export default app;