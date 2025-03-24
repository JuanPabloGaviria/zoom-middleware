import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';

export const verifyZoomWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    // Check for URL validation event
    if (req.body.event === 'endpoint.url_validation') {
      const plainToken = req.body.payload.plainToken;
      const hashAlgorithm = crypto.createHmac('sha256', config.zoom.verificationToken);
      const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
      
      logger.info('Processing Zoom URL validation');
      
      // Send response directly without returning
      res.status(200).json({
        plainToken,
        encryptedToken
      });
      // Return without passing to next middleware
      return;
    }
    
    // For regular events, verify signature
    const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`;
    const hashForVerify = crypto.createHmac('sha256', config.zoom.secretToken)
      .update(message)
      .digest('hex');
    const signature = `v0=${hashForVerify}`;
    
    if (req.headers['x-zm-signature'] !== signature) {
      logger.warn('Invalid Zoom webhook signature');
      res.status(401).json({ error: 'Invalid signature' });
      return;
    }
    
    logger.info(`Received valid Zoom webhook: ${req.body.event}`);
    next();
  } catch (error) {
    logger.error('Error verifying Zoom webhook', { error });
    next(error);
  }
};