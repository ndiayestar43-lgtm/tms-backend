import { Router } from 'express';
import {
  createPayment,
  paymentWebhook,
  getPaymentStatus,
} from '../controllers/payment.controller';
import { authenticate } from '../middleware/auth.middleware';
import { paymentRateLimit } from '../middleware/validate.middleware';

const router = Router();

// Webhook PayDunya (pas d'auth, vérification par signature)
router.post('/webhook', paymentWebhook);

// Routes protégées
router.use(authenticate);
router.post('/create', paymentRateLimit, createPayment);
router.get('/status/:token', getPaymentStatus);

export default router;
