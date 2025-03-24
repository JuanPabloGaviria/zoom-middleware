import { Router } from 'express';
import { testGoogleDriveAudio } from '../controllers/testController';

const router = Router();

router.post('/test-audio', testGoogleDriveAudio);

export default router;