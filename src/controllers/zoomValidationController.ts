import { Request, Response } from 'express';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';

/**
 * Handles Zoom URL validation requests
 * This is used during Zoom app setup to verify the webhook endpoint
 */
export const handleZoomValidation = (req: Request, res: Response): void => {
  try {
    logger.info('Processing Zoom URL validation request', { body: req.body });
    
    // Ensure the required fields are present
    if (!req.body || !req.body.payload || !req.body.payload.plainToken) {
      logger.error('Invalid validation request format', { body: req.body });
      res.status(400).json({ error: 'Invalid request format' });
      return;
    }
    
    const plainToken = req.body.payload.plainToken;
    
    // Log the token and verification token for debugging
    logger.info('Validation tokens', {
      plainToken,
      verificationTokenPrefix: config.zoom.verificationToken ? 
        (config.zoom.verificationToken.substring(0, 5) + '...') : 
        'NOT_SET'
    });
    
    // Generate the encrypted token using the verification token
    const hashAlgorithm = crypto.createHmac('sha256', config.zoom.verificationToken);
    const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
    
    logger.info('Generated response', { plainToken, encryptedToken });
    
    // Send back the required format for validation
    res.status(200).json({
      plainToken,
      encryptedToken
    });
  } catch (error) {
    logger.error('Error handling validation request', { error });
    res.status(500).json({ error: 'Internal server error' });
  }
};