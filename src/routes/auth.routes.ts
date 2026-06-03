import { Router } from 'express';
import {
  register,
  login,
  refreshToken,
  logout,
  getMe,
  changePassword,
} from '../controllers/auth.controller';
import { authenticate } from '../middleware/auth.middleware';
import { validate } from '../middleware/validate.middleware';
import { authRateLimit } from '../middleware/validate.middleware';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
} from '../utils/validators';

const router = Router();

// Routes publiques
router.post('/register', authRateLimit, validate(registerSchema), register);
router.post('/login', authRateLimit, validate(loginSchema), login);
router.post('/refresh', validate(refreshTokenSchema), refreshToken);

// Routes protégées
router.post('/logout', authenticate, logout);
router.get('/me', authenticate, getMe);
router.put('/change-password', authenticate, validate(changePasswordSchema), changePassword);

export default router;
