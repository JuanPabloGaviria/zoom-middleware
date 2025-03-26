import { Router } from 'express';
import { testGoogleDriveAudio } from '../controllers/testController';
import zoomWebSocketService from '../services/zoomWebSocketService';
import logger from '../config/logger';

const router = Router();

// Test audio processing
router.post('/test-audio', testGoogleDriveAudio);

// Test WebSocket connection
router.get('/test-ws', (req, res) => {
  const isConnected = zoomWebSocketService.isConnected();
  
  res.json({
    status: isConnected ? 'connected' : 'disconnected',
    message: isConnected 
      ? 'WebSocket connection to Zoom is active' 
      : 'WebSocket is not connected to Zoom'
  });
});

// Force WebSocket reconnection (for testing)
router.post('/force-reconnect', async (req, res) => {
  try {
    logger.info('Forcing WebSocket reconnection');
    
    // Close existing connection
    zoomWebSocketService.close();
    
    // Initialize new connection
    await zoomWebSocketService.initialize();
    
    const isConnected = zoomWebSocketService.isConnected();
    
    res.json({
      status: 'success',
      connected: isConnected,
      message: isConnected 
        ? 'WebSocket reconnected successfully' 
        : 'WebSocket reconnection initiated but not yet connected'
    });
  } catch (error) {
    logger.error('Error during forced reconnection', { error });
    
    res.status(500).json({
      status: 'error',
      message: 'Failed to reconnect WebSocket',
      error: (error as Error).message
    });
  }
});

export default router;