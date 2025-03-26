/**
 * WebSocket connection test script
 * Run with: ts-node src/test-ws.ts
 */

import dotenv from 'dotenv';
import zoomWebSocketService from './services/zoomWebSocketService';
import logger from './config/logger';

// Load environment variables
dotenv.config();

// Define test function
async function testWebSocketConnection() {
  try {
    logger.info('Starting WebSocket connection test');
    
    // Initialize WebSocket connection
    await zoomWebSocketService.initialize();
    
    // Wait for connection to establish (if it will)
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check connection status
    const isConnected = zoomWebSocketService.isConnected();
    logger.info(`WebSocket connection status: ${isConnected ? 'CONNECTED' : 'NOT CONNECTED'}`);
    
    // Close connection after test
    zoomWebSocketService.close();
    
    logger.info('WebSocket test completed');
  } catch (error) {
    logger.error('Error during WebSocket test', { error });
  }
}

// Run the test
testWebSocketConnection().catch(error => {
  console.error('Uncaught test error:', error);
});