import { Router } from 'express';
import multer from 'multer';
import {
  getProfile,
  updateProfile,
  uploadPhoto,
  getMemberCard,
  getPaymentHistory,
  getNotifications,
  markNotificationsRead,
  verifyMember,
} from '../controllers/member.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { updateProfileSchema } from '../utils/validators';

const router = Router();

// Upload en mémoire (Multer)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5 Mo max
  fileFilter(_req, file, cb) {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Seuls les formats JPEG, PNG et WEBP sont acceptés.'));
    }
  },
});

// Route publique de vérification
router.get('/verify/:memberId', verifyMember);

// Routes protégées
router.use(authenticate);

router.get('/profile', getProfile);
router.put('/profile', validate(updateProfileSchema), updateProfile);
router.post('/upload-photo', upload.single('photo'), uploadPhoto);
router.get('/card', getMemberCard);
router.get('/payments', getPaymentHistory);
router.get('/notifications', getNotifications);
router.put('/notifications/read', markNotificationsRead);

export default router;
