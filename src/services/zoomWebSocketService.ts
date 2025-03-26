import WebSocket = require('ws');
import axios from 'axios';
import config from '../config/env';
import logger from '../config/logger';
import { processZoomEvent } from '../controllers/zoomEventController';
import { getAccessToken } from './zoomAuthService';

// WebSocket readyState constants
const WS_OPEN = 1;

class ZoomWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private isConnecting: boolean = false;
  private pingInterval: NodeJS.Timeout | null = null;
  private reconnectAttempts: number = 0;
  private MAX_RECONNECT_ATTEMPTS: number = 10;
  private RECONNECT_INTERVAL: number = 5000; // 5 seconds

  /**
   * Initialize the WebSocket connection to Zoom
   */
  async initialize(): Promise<void> {
    try {
      if (this.isConnecting) {
        logger.info('WebSocket connection attempt already in progress');
        return;
      }

      this.isConnecting = true;
      
      // Get access token from the auth service
      const accessToken = await getAccessToken();
      
      // Construct WebSocket URL with query parameters including the token
      const wsUrl = `${config.zoom.wsUrl}?subscriptionId=${config.zoom.subscriptionId}&access_token=${accessToken}`;
      
      // Log URL without exposing token
      const safeUrl = wsUrl.replace(/access_token=([^&]+)/, 'access_token=***');
      logger.info(`Connecting to Zoom WebSocket at ${safeUrl}`);
      
      // Close existing connection if any
      if (this.ws) {
        this.cleanup();
      }
      
      // Create new WebSocket connection
      this.ws = new WebSocket(wsUrl);
      
      // Set up event handlers
      this.setupEventHandlers();
      
      this.isConnecting = false;
      this.reconnectAttempts = 0;
    } catch (error) {
      this.isConnecting = false;
      logger.error('Failed to initialize Zoom WebSocket', { error });
      this.scheduleReconnect();
    }
  }

  /**
   * Set up WebSocket event handlers
   */
  private setupEventHandlers(): void {
    if (!this.ws) return;

    // Handle connection open
    this.ws.on('open', () => {
      logger.info('Connected to Zoom WebSocket');
      
      // Set up ping interval to keep connection alive
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WS_OPEN) {
          try {
            this.ws.ping();
            logger.debug('Sent ping to Zoom WebSocket');
          } catch (err) {
            logger.error('Error sending ping', { error: err });
          }
        }
      }, 30000); // Every 30 seconds
    });

    // Handle messages
    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        logger.info('Received message from Zoom WebSocket');
        
        const message = data.toString();
        logger.debug('WebSocket message data', { message: message.substring(0, 200) + '...' });
        
        // Parse the message
        const eventData = JSON.parse(message);
        
        // Check for connection errors
        if (eventData.module === 'build_connection' && eventData.success === false) {
          logger.error(`WebSocket connection error: ${eventData.content || 'Unknown error'}`, { eventData });
          return;
        }
        
        // Process non-error events
        if (eventData.event_type || eventData.event) {
          processZoomEvent(eventData).catch(error => {
            logger.error('Error processing Zoom event', { error });
          });
        } else {
          logger.debug('Received non-event message', { eventData });
        }
      } catch (error) {
        logger.error('Error processing WebSocket message', { error });
      }
    });

    // Handle errors
    this.ws.on('error', (error: Error) => {
      logger.error('Zoom WebSocket error', { message: error.message });
    });

    // Handle connection close
    this.ws.on('close', (code: number, reason: string) => {
      logger.warn('Zoom WebSocket connection closed', { 
        code, 
        reason: reason || 'No reason provided'
      });
      this.cleanup();
      this.scheduleReconnect();
    });

    // Handle pong response
    this.ws.on('pong', () => {
      logger.debug('Received pong from Zoom WebSocket');
    });
  }

  /**
   * Clean up resources when connection closes
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    
    if (this.ws) {
      // Close the connection if it's still open
      if (this.ws.readyState === WS_OPEN) {
        try {
          this.ws.close();
        } catch (error) {
          logger.error('Error closing WebSocket', { error });
        }
      }
      this.ws = null;
    }
  }

  /**
   * Schedule reconnection attempt
   */
  private scheduleReconnect(): void {
    // Clear any existing reconnect timer
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
    }
    
    // Increment reconnection attempts
    this.reconnectAttempts++;
    
    if (this.reconnectAttempts > this.MAX_RECONNECT_ATTEMPTS) {
      logger.error(`Maximum reconnection attempts (${this.MAX_RECONNECT_ATTEMPTS}) reached. Giving up.`);
      return;
    }
    
    // Calculate exponential backoff with jitter
    const delay = Math.min(
      this.RECONNECT_INTERVAL * Math.pow(1.5, this.reconnectAttempts - 1),
      60000 // Max 60 seconds
    ) * (0.9 + Math.random() * 0.2); // Add ±10% jitter
    
    logger.info(`Scheduling reconnection attempt ${this.reconnectAttempts} in ${Math.round(delay)}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      logger.info(`Attempting to reconnect (attempt ${this.reconnectAttempts})`);
      await this.initialize();
    }, delay);
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WS_OPEN;
  }

  /**
   * Close the WebSocket connection
   */
  close(): void {
    logger.info('Closing Zoom WebSocket connection');
    this.cleanup();
    
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }
}

// Create singleton instance
const zoomWebSocketService = new ZoomWebSocketService();

export default zoomWebSocketService;