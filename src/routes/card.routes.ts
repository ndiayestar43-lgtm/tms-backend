import { Router } from 'express';
import {
  downloadCard,
  regenerateCard,
  adminDownloadCard,
} from '../controllers/card.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';

const router = Router();

router.use(authenticate);

// Membre
router.get('/download', downloadCard);

// Admin
router.post('/regenerate/:memberId', adminOnly, regenerateCard);
router.get('/admin/download/:memberId', adminOnly, adminDownloadCard);

export default router;
