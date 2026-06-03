import { Response, NextFunction } from 'express';
import { AuthRequest, UserRole } from '../types';
import { verifyAccessToken } from '../utils/jwt';
import { User } from '../models/User.model';
import { createApiError } from './error.middleware';
import { logger } from '../utils/logger';

/**
 * Vérifie et décode le JWT dans le header Authorization
 */
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw createApiError('Accès non autorisé. Token requis.', 401);
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw createApiError('Accès non autorisé. Token invalide.', 401);
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'TokenExpiredError') {
        throw createApiError('Session expirée. Veuillez vous reconnecter.', 401);
      }
      throw createApiError('Token invalide.', 401);
    }

    // Vérification que l'utilisateur existe toujours et est actif
    const user = await User.findById(decoded.id).select('-password -refreshToken');

    if (!user) {
      throw createApiError('Utilisateur introuvable.', 401);
    }

    if (!user.isActive) {
      throw createApiError('Compte désactivé. Veuillez contacter l\'administration.', 403);
    }

    req.user = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };

    next();
  } catch (error) {
    next(error);
  }
};

/**
 * Autorise uniquement certains rôles
 */
export const authorize = (...roles: UserRole[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      next(createApiError('Accès non autorisé.', 401));
      return;
    }

    if (!roles.includes(req.user.role)) {
      logger.warn(`Accès refusé - Rôle: ${req.user.role}, Requis: ${roles.join(', ')}, URL: ${req.originalUrl}`);
      next(createApiError('Accès refusé. Permissions insuffisantes.', 403));
      return;
    }

    next();
  };
};

/**
 * Raccourci : admin uniquement
 */
export const adminOnly = authorize(UserRole.ADMIN, UserRole.SUPER_ADMIN);

/**
 * Raccourci : super admin uniquement
 */
export const superAdminOnly = authorize(UserRole.SUPER_ADMIN);
