import { Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Member } from '../models/Member.model';
import { Payment } from '../models/Payment.model';
import { Card } from '../models/Card.model';
import { Notification } from '../models/Log.model';
import { AuthRequest, MemberStatus } from '../types';
import { createApiError } from '../middleware/error.middleware';
import { uploadBufferToCloudinary, deleteFromCloudinary } from '../config/cloudinary';
import { logger } from '../utils/logger';
import fs from 'fs';

// ========================
// GET /api/member/profile
// ========================

export const getProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) throw createApiError('Utilisateur introuvable.', 404);

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
// PUT /api/member/profile
// ========================

export const updateProfile = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, address } = req.body;

    const user = await User.findByIdAndUpdate(
      req.user?.id,
      { name, phone, address },
      { new: true, runValidators: true }
    );

    if (!user) throw createApiError('Utilisateur introuvable.', 404);

    res.status(200).json({
      success: true,
      message: 'Profil mis à jour.',
      data: { user },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/member/upload-photo
// ========================

export const uploadPhoto = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    if (!req.file) {
      throw createApiError('Aucune photo fournie.', 400);
    }

    const user = await User.findById(req.user?.id);
    if (!user) throw createApiError('Utilisateur introuvable.', 404);

    // Supprimer l'ancienne photo si elle existe
    if (user.photoPublicId) {
      await deleteFromCloudinary(user.photoPublicId);
    }

    // Upload sur Cloudinary
    const { url, publicId } = await uploadBufferToCloudinary(
      req.file.buffer,
      'photos',
      `photo_${user._id}`,
      'image'
    );

    // Supprimer le fichier temporaire si nécessaire
    if (req.file.path) {
      try { fs.unlinkSync(req.file.path); } catch { /* ignore */ }
    }

    await User.findByIdAndUpdate(user._id, {
      photo: url,
      photoPublicId: publicId,
    });

    res.status(200).json({
      success: true,
      message: 'Photo mise à jour.',
      data: { photoUrl: url },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/member/card
// ========================

export const getMemberCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findOne({ user: req.user?.id }).populate('user');
    if (!member) throw createApiError('Profil membre introuvable.', 404);

    if (member.status !== MemberStatus.ACTIVE) {
      throw createApiError('Votre carte est inactive. Effectuez votre cotisation.', 403);
    }

    const card = await Card.findOne({ member: member._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Carte membre récupérée.',
      data: { member, card },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/member/payments
// ========================

export const getPaymentHistory = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const skip = (page - 1) * limit;

    const total = await Payment.countDocuments({ user: req.user?.id });
    const payments = await Payment.find({ user: req.user?.id })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Historique des paiements.',
      data: { payments },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/member/notifications
// ========================

export const getNotifications = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const notifications = await Notification.find({ user: req.user?.id })
      .sort({ createdAt: -1 })
      .limit(20);

    const unreadCount = await Notification.countDocuments({
      user: req.user?.id,
      isRead: false,
    });

    res.status(200).json({
      success: true,
      message: 'Notifications récupérées.',
      data: { notifications, unreadCount },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// PUT /api/member/notifications/read
// ========================

export const markNotificationsRead = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    await Notification.updateMany(
      { user: req.user?.id, isRead: false },
      { isRead: true }
    );

    res.status(200).json({
      success: true,
      message: 'Notifications marquées comme lues.',
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/member/verify/:memberId  (public)
// ========================

export const verifyMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { memberId } = req.params;

    const member = await Member.findOne({ memberNumber: memberId }).populate<{
      user: { name: string; email: string; photo: string };
    }>('user', 'name email photo');

    if (!member) {
      res.status(404).json({
        success: false,
        message: 'Carte invalide. Ce membre n\'existe pas dans notre registre.',
        data: { valid: false },
      });
      return;
    }

    const isActive =
      member.status === MemberStatus.ACTIVE && member.expiryDate > new Date();

    res.status(200).json({
      success: true,
      message: isActive ? 'Carte valide.' : 'Carte expirée.',
      data: {
        valid: isActive,
        member: {
          name: (member.user as { name: string }).name,
          memberNumber: member.memberNumber,
          status: member.status,
          issueDate: member.issueDate,
          expiryDate: member.expiryDate,
          photo: (member.user as { photo: string }).photo,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};
