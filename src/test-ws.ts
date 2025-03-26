/**
 * WebSocket connection test script
 * Run with: npm run test:ws
 */

import dotenv from 'dotenv';
import zoomWebSocketService from './services/zoomWebSocketService';
import logger from './config/logger';
import config from './config/env';

// Load environment variables
dotenv.config();

// Define test function
async function testWebSocketConnection() {
  try {
    logger.info('Starting WebSocket connection test');
    
    // Verify required environment variables
    const requiredEnvVars = [
      'ZOOM_ACCOUNT_ID',
      'ZOOM_CLIENT_ID',
      'ZOOM_CLIENT_SECRET',
      'ZOOM_SUBSCRIPTION_ID'
    ];
    
    const missingVars = requiredEnvVars.filter(varName => !process.env[varName]);
    
    if (missingVars.length > 0) {
      logger.error(`Missing required environment variables: ${missingVars.join(', ')}`);
      return;
    }
    
    // Log configuration
    logger.info('Zoom WebSocket Configuration:');
    logger.info(`Account ID: ${config.zoom.accountId}`);
    logger.info(`Client ID: ${config.zoom.clientId}`);
    logger.info(`Subscription ID: ${config.zoom.subscriptionId}`);
    logger.info(`WebSocket URL: ${config.zoom.wsUrl}`);
    
    // Initialize WebSocket connection
    await zoomWebSocketService.initialize();
    
    // Wait for connection to establish (if it will)
    logger.info('Waiting for connection to establish...');
    await new Promise(resolve => setTimeout(resolve, 5000));
    
    // Check connection status
    const isConnected = zoomWebSocketService.isConnected();
    logger.info(`WebSocket connection status: ${isConnected ? 'CONNECTED' : 'NOT CONNECTED'}`);
    
    // Keep script running to observe connection behavior
    logger.info('Keeping connection open for 30 seconds to observe behavior...');
    await new Promise(resolve => setTimeout(resolve, 30000));
    
    // Close connection after test
    logger.info('Test complete, closing connection');
    zoomWebSocketService.close();
    
    logger.info('WebSocket test completed');
  } catch (error) {
    logger.error('Error during WebSocket test', { error });
  }
}

// Run the test
testWebSocketConnection().catch(error => {
  console.error('Uncaught test error:', error);
  process.exit(1);
}).finally(() => {
  // Ensure process exits
  setTimeout(() => process.exit(0), 1000);
});