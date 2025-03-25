import express from 'express';
import crypto from 'crypto';
import { handleZoomWebhook } from '../controllers/webhookController';
import { verifyZoomWebhook } from '../middleware/zoomAuthMiddleware';
import logger from '../config/logger';

const router = express.Router();

// Route for Zoom webhook URL validation during app setup
router.post('/zoom/validate', function(req, res) {
  logger.info('Received validation request to /webhook/zoom/validate');
  // Process the validation directly
  try {
    const plainToken = req.body.payload.plainToken;
    const verificationToken = process.env.ZOOM_VERIFICATION_TOKEN || '';
    const hashAlgorithm = crypto.createHmac('sha256', verificationToken);
    const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
    
    res.status(200).json({
      plainToken,
      encryptedToken
    });
  } catch (error) {
    logger.error('Error in validate endpoint', { error });
    res.status(500).json({ error: 'Validation processing failed' });
  }
});

// Add a GET handler for documentation
router.get('/zoom', function(req, res) {
  res.status(200).json({
    message: 'Zoom webhook endpoint',
    usage: 'This endpoint accepts POST requests from Zoom webhooks'
  });
});

// Main route for handling Zoom webhooks
router.post('/zoom', verifyZoomWebhook, function(req, res) {
  // The middleware will handle special cases like validation
  handleZoomWebhook(req, res).catch((err: Error) => {
    logger.error('Uncaught error in webhook handler:', { error: err.message, stack: err.stack });
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

// Add a route specifically for URL validation without middleware
router.post('/zoom/direct', function(req, res) {
  logger.info('Received direct webhook request', { body: req.body });
  
  // Handle Zoom URL validation
  if (req.body && req.body.event === 'endpoint.url_validation') {
    try {
      const plainToken = req.body.payload.plainToken;
      const verificationToken = process.env.ZOOM_VERIFICATION_TOKEN || '';
      logger.info('Using verification token', { tokenPrefix: verificationToken.substring(0, 5) + '...' });
      
      const hashAlgorithm = crypto.createHmac('sha256', verificationToken);
      const encryptedToken = hashAlgorithm.update(plainToken).digest('hex');
      
      logger.info('Generating validation response', { plainToken, encryptedToken });
      
      res.status(200).json({
        plainToken,
        encryptedToken
      });
      return;
    } catch (error) {
      logger.error('Error in direct validation', { error });
      res.status(500).json({ error: 'Validation processing failed' });
      return;
    }
  }
  
  // For other events, just acknowledge
  res.status(200).json({ status: 'Event received directly' });
});

export default router;