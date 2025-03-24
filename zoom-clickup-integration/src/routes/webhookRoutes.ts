import { Router } from 'express';
import { handleZoomWebhook } from '../controllers/webhookController';
import { verifyZoomWebhook } from '../middleware/zoomAuthMiddleware';

const router = Router();

// Fix for the type error in verifyZoomWebhook middleware
router.post('/zoom', verifyZoomWebhook, (req, res) => {
  handleZoomWebhook(req, res).catch(err => {
    console.error('Uncaught error in webhook handler:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });
});

export default router;