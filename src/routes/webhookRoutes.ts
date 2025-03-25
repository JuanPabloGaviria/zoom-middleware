import { Router } from 'express';
import { handleZoomWebhook } from '../controllers/webhookController';
import { handleZoomValidation } from '../controllers/zoomValidationController';
import { verifyZoomWebhook } from '../middleware/zoomAuthMiddleware';

const router = Router();

// Route for Zoom webhook URL validation during app setup
router.post('/zoom/validate', (req, res) => {
  handleZoomValidation(req, res);
});

// Main route for handling Zoom webhooks
router.post('/zoom', verifyZoomWebhook, (req, res) => {
  // The middleware will handle special cases like validation
  handleZoomWebhook(req, res).catch((err: Error) => {
    console.error('Uncaught error in webhook handler:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

export default router;