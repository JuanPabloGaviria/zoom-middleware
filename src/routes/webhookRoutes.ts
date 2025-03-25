import { Router } from 'express';
import { handleZoomWebhook } from '../controllers/webhookController';
import { verifyZoomWebhook } from '../middleware/zoomAuthMiddleware';

const router = Router();

// Fixed route handler
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