import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Member } from '../models/Member.model';
import { ActivityLog } from '../models/Log.model';
import { AuthRequest, UserRole } from '../types';
import {
  generateTokenPair,
  generateAccessToken,
  verifyRefreshToken,
  generateMemberNumber,
} from '../utils/jwt';
import { createApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ========================
// POST /api/auth/register
// ========================

export const register = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, email, phone, password, address } = req.body;

    // Vérifier si l'email existe déjà
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw createApiError('Un compte avec cet email existe déjà.', 409);
    }

    // Créer l'utilisateur
    const user = await User.create({
      name,
      email,
      phone,
      password,
      address,
      role: UserRole.MEMBER,
    });

    // Compter les membres pour générer le numéro
    const memberCount = await Member.countDocuments();
    const memberNumber = await generateMemberNumber(memberCount);

    // Créer le profil membre (statut PENDING jusqu'au paiement)
    await Member.create({
      user: user._id,
      memberNumber,
    });

    // Génération des tokens
    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    // Sauvegarde du refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Log d'activité
    await ActivityLog.create({
      actor: user._id,
      actorRole: UserRole.MEMBER,
      action: 'USER_REGISTERED',
      targetType: 'User',
      target: user._id,
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info(`Nouvel utilisateur inscrit : ${email}`);

    res.status(201).json({
      success: true,
      message: 'Inscription réussie ! Bienvenue dans TMS Connect.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
        },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/auth/login
// ========================

export const login = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { email, password } = req.body;

    // Récupérer l'utilisateur avec le mot de passe
    const user = await User.findOne({ email }).select('+password +refreshToken');

    if (!user) {
      throw createApiError('Email ou mot de passe incorrect.', 401);
    }

    if (!user.isActive) {
      throw createApiError('Compte désactivé. Contactez l\'administration.', 403);
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      throw createApiError('Email ou mot de passe incorrect.', 401);
    }

    // Génération des tokens
    const tokenPayload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    };
    const { accessToken, refreshToken } = generateTokenPair(tokenPayload);

    // Mise à jour du refresh token
    await User.findByIdAndUpdate(user._id, { refreshToken });

    // Log
    await ActivityLog.create({
      actor: user._id,
      actorRole: user.role,
      action: 'USER_LOGIN',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    logger.info(`Connexion réussie : ${email}`);

    res.status(200).json({
      success: true,
      message: 'Connexion réussie.',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role,
          photo: user.photo,
        },
        tokens: { accessToken, refreshToken },
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/auth/refresh
// ========================

export const refreshToken = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { refreshToken: token } = req.body;

    if (!token) {
      throw createApiError('Refresh token requis.', 401);
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(token);
    } catch {
      throw createApiError('Refresh token invalide ou expiré.', 401);
    }

    // Vérifier que le refresh token correspond à celui en BDD
    const user = await User.findById(decoded.id).select('+refreshToken');
    if (!user || user.refreshToken !== token) {
      throw createApiError('Refresh token invalide.', 401);
    }

    if (!user.isActive) {
      throw createApiError('Compte désactivé.', 403);
    }

    // Générer un nouvel access token
    const newAccessToken = generateAccessToken({
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    });

    res.status(200).json({
      success: true,
      message: 'Token renouvelé.',
      data: { accessToken: newAccessToken },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/auth/logout
// ========================

export const logout = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (req.user) {
      // Invalider le refresh token en BDD
      await User.findByIdAndUpdate(req.user.id, { refreshToken: null });

      await ActivityLog.create({
        actor: req.user.id,
        actorRole: req.user.role as UserRole,
        action: 'USER_LOGOUT',
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'],
      });
    }

    res.status(200).json({
      success: true,
      message: 'Déconnexion réussie.',
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/auth/me
// ========================

export const getMe = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);

    if (!user) {
      throw createApiError('Utilisateur introuvable.', 404);
    }

    // Récupérer également le profil membre
    const member = await Member.findOne({ user: user._id });

    res.status(200).json({
      success: true,
      message: 'Profil récupéré.',
      data: { user, member },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// PUT /api/auth/change-password
// ========================

export const changePassword = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { currentPassword, newPassword } = req.body;

    const user = await User.findById(req.user?.id).select('+password');
    if (!user) {
      throw createApiError('Utilisateur introuvable.', 404);
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      throw createApiError('Mot de passe actuel incorrect.', 400);
    }

    user.password = newPassword;
    await user.save();

    // Invalider tous les refresh tokens existants
    await User.findByIdAndUpdate(user._id, { refreshToken: null });

    await ActivityLog.create({
      actor: user._id,
      actorRole: user.role,
      action: 'PASSWORD_CHANGED',
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    });

    res.status(200).json({
      success: true,
      message: 'Mot de passe modifié avec succès.',
    });
  } catch (error) {
    next(error);
  }
};
