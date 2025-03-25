import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import config from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import webhookRoutes from './routes/webhookRoutes';
import testRoutes from './routes/testRoutes';

// Create Express application
const app = express();

// Middleware for parsing JSON and URL-encoded data
// Set higher limits since Zoom webhook payloads can be large
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use(cors());

// Routes
app.use('/webhook', webhookRoutes);
app.use('/api', testRoutes);

// Basic route
app.get('/', (req, res) => {
  res.json({
    message: 'Zoom-ClickUp Integration API',
    status: 'Running'
  });
});

// Documentation routes
app.get('/docs', (req, res) => {
  res.json({
    message: 'API Documentation',
    endpoints: {
      '/': 'Status check endpoint',
      '/webhook/zoom': 'Zoom webhook endpoint (POST)',
      '/api/test-audio': 'Test endpoint for audio processing (POST)'
    }
  });
});

// Add a debug route for Zoom webhook verification
app.post('/webhook/zoom/debug', (req, res) => {
  logger.info('Received debug webhook request', { body: req.body, headers: req.headers });
  res.status(200).json({ message: 'Debug endpoint received request' });
});

// Error handler
app.use(errorHandler);

// Start server
const PORT = config.port;
app.listen(PORT, () => {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`Zoom webhook URL: https://[your-domain]/webhook/zoom`);
});

export default app;