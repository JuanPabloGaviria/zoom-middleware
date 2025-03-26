import { WebSocket } from 'ws';
import axios from 'axios';
import config from '../config/env';
import logger from '../config/logger';
import { processZoomEvent } from '../controllers/zoomEventController';

class ZoomWebSocketService {
  private ws: WebSocket | null = null;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private accessToken: string | null = null;
  private tokenExpiry: number = 0;
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
      
      // Ensure we have a valid access token
      await this.getAccessToken();
      if (!this.accessToken) {
        throw new Error('Failed to obtain Zoom access token');
      }

      // Construct WebSocket URL with query parameters
      const wsUrl = `${config.zoom.wsUrl}?subscriptionId=${config.zoom.subscriptionId}`;
      
      logger.info(`Connecting to Zoom WebSocket at ${wsUrl}`);
      
      // Close existing connection if any
      if (this.ws) {
        this.cleanup();
      }
      
      // Create new WebSocket connection
      this.ws = new WebSocket(wsUrl, {
        headers: {
          'Authorization': `Bearer ${this.accessToken}`
        }
      });
      
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

    this.ws.addEventListener('open', () => {
      logger.info('Connected to Zoom WebSocket');
      
      // Set up ping interval to keep connection alive
      this.pingInterval = setInterval(() => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          this.ws.ping();
          logger.debug('Sent ping to Zoom WebSocket');
        }
      }, 30000); // Every 30 seconds
    });

    this.ws.addEventListener('message', async (event) => {
      try {
        logger.info('Received message from Zoom WebSocket');
        
        const message = event.data.toString();
        logger.debug('WebSocket message data', { message: message.substring(0, 200) + '...' });
        
        // Parse the message
        const eventData = JSON.parse(message);
        
        // Process the event
        await processZoomEvent(eventData);
      } catch (error) {
        logger.error('Error processing WebSocket message', { error });
      }
    });

    this.ws.addEventListener('error', (event) => {
      logger.error('Zoom WebSocket error', { error: event });
    });

    this.ws.addEventListener('close', (event) => {
      logger.warn('Zoom WebSocket connection closed', { 
        code: event.code, 
        reason: event.reason || 'No reason provided'
      });
      this.cleanup();
      this.scheduleReconnect();
    });

    // Use a custom event handler for pong event since addEventListener doesn't support it
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
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.close();
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
   * Get a Zoom access token using client credentials flow
   */
  private async getAccessToken(): Promise<void> {
    try {
      // Check if we already have a valid token
      const currentTime = Math.floor(Date.now() / 1000);
      if (this.accessToken && this.tokenExpiry > currentTime + 60) {
        logger.debug('Using existing Zoom access token');
        return;
      }

      logger.info('Obtaining new Zoom access token');
      
      // Create basic auth string from client ID and secret
      const credentials = Buffer.from(
        `${config.zoom.clientId}:${config.zoom.clientSecret}`
      ).toString('base64');
      
      // Request new token
      const response = await axios.post(
        config.zoom.oauth.tokenUrl,
        'grant_type=account_credentials&account_id=' + config.zoom.accountId,
        {
          headers: {
            'Authorization': `Basic ${credentials}`,
            'Content-Type': 'application/x-www-form-urlencoded'
          }
        }
      );
      
      // Update token and expiry
      this.accessToken = response.data.access_token;
      // Calculate expiry time by adding expiry seconds to current time
      this.tokenExpiry = Math.floor(Date.now() / 1000) + response.data.expires_in;
      
      logger.info('Successfully obtained Zoom access token', {
        expiresIn: response.data.expires_in,
        tokenType: response.data.token_type
      });
    } catch (error) {
      const err = error as Error & { response?: { status?: number, statusText?: string, data?: any } };
      
      logger.error('Failed to obtain Zoom access token', {
        message: err.message,
        status: err.response?.status,
        statusText: err.response?.statusText,
        data: err.response?.data
      });
      this.accessToken = null;
      throw err;
    }
  }

  /**
   * Get current connection status
   */
  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
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