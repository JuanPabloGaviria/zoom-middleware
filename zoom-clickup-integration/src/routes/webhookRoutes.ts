import { Router } from 'express';
import { handleZoomWebhook } from '../controllers/webhookController';
import { verifyZoomWebhook } from '../middleware/zoomAuthMiddleware';

const router = Router();

router.post('/zoom', verifyZoomWebhook, handleZoomWebhook);

export default router;