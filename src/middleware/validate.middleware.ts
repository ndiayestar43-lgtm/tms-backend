import { Request, Response, NextFunction } from 'express';
import { ZodSchema } from 'zod';
import rateLimit from 'express-rate-limit';
import { AuthRequest, UserRole } from '../types';
import { ActivityLog } from '../models/Log.model';
import { logger } from '../utils/logger';
import { env } from '../config/env';

// ========================
// VALIDATION ZOD
// ========================

export const validate = (schema: ZodSchema) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const result = schema.safeParse({
      body: req.body,
      query: req.query,
      params: req.params,
    });

    if (!result.success) {
      const errors = result.error.issues.map((issue) => ({
        field: issue.path.slice(1).join('.'),
        message: issue.message,
      }));
      res.status(400).json({
        success: false,
        message: 'Données de la requête invalides',
        errors,
      });
      return;
    }

    // Remplace req.body par les données validées et sanitisées
    req.body = result.data.body || req.body;
    next();
  };
};

// ========================
// RATE LIMITERS
// ========================

const windowMs = parseInt(env.RATE_LIMIT_WINDOW_MS, 10);
const max = parseInt(env.RATE_LIMIT_MAX, 10);

export const globalRateLimit = rateLimit({
  windowMs,
  max,
  message: {
    success: false,
    message: 'Trop de requêtes. Veuillez patienter avant de réessayer.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: {
    success: false,
    message: 'Trop de tentatives de connexion. Réessayez dans 15 minutes.',
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true,
});

export const paymentRateLimit = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 heure
  max: 20,
  message: {
    success: false,
    message: 'Limite de paiements atteinte. Réessayez dans 1 heure.',
  },
  standardHeaders: true,
  legacyHeaders: false,
});

export const aiRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 15,
  message: {
    success: false,
    message: "Limite de messages IA atteinte. Patientez 1 minute.",
  },
  standardHeaders: true,
  legacyHeaders: false,
});

// ========================
// AUDIT LOG MIDDLEWARE
// ========================

export const auditLog = (action: string, targetType?: string) => {
  return async (req: AuthRequest, _res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.user) {
        await ActivityLog.create({
          actor: req.user.id,
          actorRole: req.user.role as UserRole,
          action,
          targetType,
          target: req.params?.id,
          details: {
            method: req.method,
            url: req.originalUrl,
            body: sanitizeLogBody(req.body),
          },
          ipAddress: req.ip || req.socket.remoteAddress,
          userAgent: req.headers['user-agent'],
        });
      }
    } catch (err) {
      logger.error('Erreur audit log :', err);
    }
    next();
  };
};

const sensitiveFields = ['password', 'newPassword', 'currentPassword', 'refreshToken'];

const sanitizeLogBody = (body: Record<string, unknown>): Record<string, unknown> => {
  if (!body || typeof body !== 'object') return {};
  const sanitized: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(body)) {
    sanitized[key] = sensitiveFields.includes(key) ? '***' : value;
  }
  return sanitized;
};
