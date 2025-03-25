import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import config from '../config/env';
import logger from '../config/logger';

export const verifyZoomWebhook = (req: Request, res: Response, next: NextFunction): void => {
  try {
    logger.info('Received Zoom webhook request', { 
      event: req.body?.event,
      method: req.method,
      path: req.path
    });
    
    // Check for URL validation event
    if (req.body && req.body.event === 'endpoint.url_validation') {
      logger.info('Processing Zoom URL validation', { payload: req.body.payload });
      
      const plainToken = req.body.payload.plainToken;
      const hashAlgorithm = crypto.createHmac('sha256', config.zoom.verificationToken);
      const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
      
      logger.info('Generated validation response', { 
        plainToken, 
        verificationTokenPrefix: config.zoom.verificationToken.substring(0, 5) + '...',
        encryptedToken 
      });
      
      // Send response for validation
      res.status(200).json({
        plainToken,
        encryptedToken
      });
      // Return here to prevent calling next()
      return;
    }
    
    // Log debug info for regular events
    logger.info('Webhook details', {
      secretTokenPrefix: config.zoom.secretToken.substring(0, 5) + '...',
      timestamp: req.headers['x-zm-request-timestamp'],
      signatureHeader: req.headers['x-zm-signature']
    });
    
    // Skip signature verification during development if needed
    if (process.env.BYPASS_ZOOM_VERIFICATION === 'true') {
      logger.warn('Bypassing Zoom signature verification (not secure for production)');
      next();
      return;
    }
    
    // For regular events, verify signature
    if (!req.headers['x-zm-request-timestamp'] || !req.headers['x-zm-signature']) {
      logger.warn('Missing Zoom webhook headers');
      res.status(401).json({ error: 'Missing required headers' });
      return;
    }
    
    const message = `v0:${req.headers['x-zm-request-timestamp']}:${JSON.stringify(req.body)}`;
    const hashForVerify = crypto.createHmac('sha256', config.zoom.secretToken)
      .update(message)
      .digest('hex');
    const signature = `v0=${hashForVerify}`;
    
    if (req.headers['x-zm-signature'] !== signature) {
      logger.warn('Invalid Zoom webhook signature', {
        expected: signature,
        received: req.headers['x-zm-signature']
      });
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