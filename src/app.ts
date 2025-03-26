import express from 'express';
import cors from 'cors';
import bodyParser from 'body-parser';
import config from './config/env';
import logger from './config/logger';
import { errorHandler } from './middleware/errorHandler';
import testRoutes from './routes/testRoutes';
import zoomWebSocketService from './services/zoomWebSocketService';

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

// Configure middleware
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

// CORS middleware
app.use(cors());

// Basic route
app.get('/', function(req, res) {
  res.json({
    message: 'Zoom-ClickUp Integration API',
    status: 'Running',
    wsConnected: zoomWebSocketService.isConnected(),
    documentation: 'Visit /docs for API documentation'
  });
});

// Documentation route
app.get('/docs', function(req, res) {
  res.json({
    message: 'API Documentation',
    endpoints: {
      '/': 'Status check endpoint',
      '/api/test-audio': 'Test endpoint for audio processing (POST)',
      '/api/ws-status': 'Check WebSocket connection status (GET)',
      '/api/reconnect': 'Force WebSocket reconnection (POST)'
    },
    connectionType: 'This application uses WebSockets to connect to Zoom for real-time events'
  });
});

// Mount route handlers
app.use('/api', testRoutes);

// Add WebSocket status check endpoint
app.get('/api/ws-status', (req, res) => {
  const isConnected = zoomWebSocketService.isConnected();
  res.json({
    connected: isConnected,
    message: isConnected ? 'WebSocket connected to Zoom' : 'WebSocket not connected'
  });
});

// Add endpoint to force reconnection
app.post('/api/reconnect', async (req, res) => {
  try {
    // Close existing connection
    zoomWebSocketService.close();
    
    // Initialize new connection
    await zoomWebSocketService.initialize();
    
    res.json({
      status: 'success',
      message: 'WebSocket reconnection initiated',
      connected: zoomWebSocketService.isConnected()
    });
  } catch (error) {
    logger.error('Error reconnecting WebSocket', { error });
    res.status(500).json({
      status: 'error',
      message: 'Failed to reconnect WebSocket',
      error: (error as Error).message
    });
  }
});

// Error handler (must be last)
app.use(errorHandler);

// Start server
const PORT = config.port;
const server = app.listen(PORT, async function() {
  logger.info(`Server running on port ${PORT}`);
  logger.info(`Environment: ${config.nodeEnv}`);
  logger.info(`API Base URL: http://localhost:${PORT}`);
  
  // Validate required environment variables
  const requiredEnvVars = [
    'ZOOM_ACCOUNT_ID',
    'ZOOM_CLIENT_ID',
    'ZOOM_CLIENT_SECRET',
    'ZOOM_SUBSCRIPTION_ID'
  ];
  
  const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
  
  if (missingVars.length > 0) {
    logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
    logger.info('WebSocket connection to Zoom will not be established');
  } else {
    // Initialize WebSocket connection
    try {
      logger.info('Initializing Zoom WebSocket connection...');
      await zoomWebSocketService.initialize();
    } catch (error) {
      logger.error('Failed to initialize WebSocket connection', { error });
    }
  }
});

// Handle shutdown gracefully
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  zoomWebSocketService.close();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  zoomWebSocketService.close();
  server.close(() => {
    logger.info('HTTP server closed');
    process.exit(0);
  });
});

export default app;