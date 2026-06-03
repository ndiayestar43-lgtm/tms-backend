import { Response, NextFunction } from 'express';
import axios from 'axios';
import { Member } from '../models/Member.model';
import { Card } from '../models/Card.model';
import { User } from '../models/User.model';
import { AuthRequest, MemberStatus, UserRole } from '../types';
import { createApiError } from '../middleware/error.middleware';
import { generateMemberCardPDF } from '../services/card.service';
import { ActivityLog } from '../models/Log.model';
import { logger } from '../utils/logger';

// ========================
// GET /api/card/download
// ========================

export const downloadCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findOne({ user: req.user?.id });
    if (!member) throw createApiError('Profil membre introuvable.', 404);

    if (member.status !== MemberStatus.ACTIVE) {
      throw createApiError('Votre carte est inactive. Payez votre cotisation.', 403);
    }

    const card = await Card.findOne({ member: member._id }).sort({ createdAt: -1 });
    if (!card || !card.pdfUrl) {
      throw createApiError('Carte non encore générée. Contactez l\'administration.', 404);
    }

    // Stream le PDF depuis Cloudinary
    const response = await axios.get(card.pdfUrl, {
      responseType: 'stream',
      timeout: 15000,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carte_tms_${member.memberNumber}.pdf"`
    );

    response.data.pipe(res);

    logger.info(`Carte téléchargée : ${member.memberNumber} par ${req.user?.email}`);
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/card/regenerate   (admin)
// ========================

export const regenerateCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { memberId } = req.params;

    const member = await Member.findById(memberId).populate<{
      user: { _id: string; name: string; email: string; photo: string };
    }>('user');

    if (!member) throw createApiError('Membre introuvable.', 404);

    const user = member.user as { _id: string; name: string; email: string; photo: string };

    const generated = await generateMemberCardPDF({
      memberNumber: member.memberNumber,
      memberName: user.name,
      memberPhoto: user.photo,
      issueDate: member.issueDate,
      expiryDate: member.expiryDate,
      status: member.status,
    });

    // Mettre à jour ou créer la carte
    await Card.findOneAndUpdate(
      { member: member._id },
      {
        pdfUrl: generated.pdfUrl,
        pdfPublicId: generated.pdfPublicId,
        qrCodeUrl: generated.qrCodeUrl,
        qrCodeData: generated.qrCodeData,
        generatedAt: new Date(),
        $inc: { version: 1 },
      },
      { upsert: true, new: true }
    );

    await Member.findByIdAndUpdate(member._id, {
      cardUrl: generated.pdfUrl,
      qrCodeUrl: generated.qrCodeUrl,
    });

    await ActivityLog.create({
      actor: req.user!.id,
      actorRole: req.user!.role as UserRole,
      action: 'ADMIN_REGENERATE_CARD',
      targetType: 'Member',
      target: member._id,
      ipAddress: req.ip,
    });

    logger.info(`Carte régénérée pour ${member.memberNumber} par admin ${req.user?.email}`);

    res.status(200).json({
      success: true,
      message: 'Carte régénérée avec succès.',
      data: {
        pdfUrl: generated.pdfUrl,
        qrCodeUrl: generated.qrCodeUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/card/admin/download/:memberId  (admin)
// ========================

export const adminDownloadCard = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { memberId } = req.params;

    const member = await Member.findById(memberId);
    if (!member) throw createApiError('Membre introuvable.', 404);

    const card = await Card.findOne({ member: member._id }).sort({ createdAt: -1 });
    if (!card || !card.pdfUrl) {
      throw createApiError('Aucune carte générée pour ce membre.', 404);
    }

    const response = await axios.get(card.pdfUrl, {
      responseType: 'stream',
      timeout: 15000,
    });

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="carte_tms_${member.memberNumber}.pdf"`
    );

    response.data.pipe(res);
  } catch (error) {
    next(error);
  }
};
