import axios from 'axios';
import config from '../config/env';
import logger from '../config/logger';
import { ApiError } from '../types';

// Token cache
let accessToken: string = '';
let tokenExpiry: number = 0;

/**
 * Get a valid Zoom OAuth access token
 * @returns Access token string
 */
export const getAccessToken = async (): Promise<string> => {
  try {
    // Check if we already have a valid token
    const currentTime = Math.floor(Date.now() / 1000);
    if (accessToken && tokenExpiry > currentTime + 60) {
      logger.debug('Using cached Zoom API access token');
      return accessToken;
    }

    logger.info('Obtaining new Zoom API access token');
    
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
    
    // Verify response contains token
    if (!response.data?.access_token) {
      throw new Error('No access token returned from Zoom API');
    }
    
    // Update token and expiry
    accessToken = response.data.access_token;
    // Calculate expiry time by adding expiry seconds to current time
    tokenExpiry = Math.floor(Date.now() / 1000) + response.data.expires_in;
    
    logger.info('Successfully obtained Zoom API access token', {
      expiresIn: response.data.expires_in,
      tokenType: response.data.token_type
    });
    
    return accessToken;
  } catch (err) {
    const error = err as ApiError;
    logger.error('Failed to obtain Zoom API access token', {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    });
    
    throw new Error(`Failed to obtain Zoom API access token: ${error.message}`);
  }
};

/**
 * Invalidate the current access token
 */
export const invalidateToken = (): void => {
  accessToken = '';
  tokenExpiry = 0;
  logger.info('Zoom API access token invalidated');
};