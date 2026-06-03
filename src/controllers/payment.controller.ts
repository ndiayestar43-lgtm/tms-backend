import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Member } from '../models/Member.model';
import { Payment } from '../models/Payment.model';
import { Card } from '../models/Card.model';
import { Notification } from '../models/Log.model';
import { AuthRequest, MemberStatus, PaymentStatus, PaymentMethod, NotificationType } from '../types';
import { createApiError } from '../middleware/error.middleware';
import {
  createPaydunyaInvoice,
  verifyPaydunyaInvoice,
  mapPaymentMethod,
} from '../services/paydunya.service';
import { generateMemberCardPDF } from '../services/card.service';
import {
  sendPaymentSuccessEmail,
  sendCardGeneratedEmail,
} from '../services/email.service';
import { calculateExpiryDate } from '../utils/jwt';
import { logger } from '../utils/logger';

const COTISATION_AMOUNT = 2000; // FCFA

// ========================
// POST /api/payment/create
// ========================

export const createPayment = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user?.id);
    if (!user) throw createApiError('Utilisateur introuvable.', 404);

    const member = await Member.findOne({ user: user._id });
    if (!member) throw createApiError('Profil membre introuvable.', 404);

    // Vérifier s'il y a déjà un paiement en cours
    const pendingPayment = await Payment.findOne({
      user: user._id,
      status: PaymentStatus.PENDING,
      createdAt: { $gte: new Date(Date.now() - 30 * 60 * 1000) }, // 30 min
    });

    if (pendingPayment) {
      throw createApiError(
        'Un paiement est déjà en cours. Attendez 30 minutes avant de réessayer.',
        409
      );
    }

    // Créer l'invoice PayDunya
    const { invoiceToken, checkoutUrl } = await createPaydunyaInvoice({
      userId: user._id.toString(),
      memberNumber: member.memberNumber,
      userName: user.name,
      userEmail: user.email,
      userPhone: user.phone,
      amount: COTISATION_AMOUNT,
      description: `Cotisation TMS ${new Date().getFullYear()} - ${member.memberNumber}`,
    });

    // Enregistrer le paiement en statut PENDING
    const payment = await Payment.create({
      user: user._id,
      member: member._id,
      amount: COTISATION_AMOUNT,
      currency: 'XOF',
      status: PaymentStatus.PENDING,
      paydunyaInvoiceToken: invoiceToken,
    });

    logger.info(`Paiement initié : ${payment._id} - Token: ${invoiceToken}`);

    res.status(201).json({
      success: true,
      message: 'Paiement initié. Redirigez vers la page de paiement.',
      data: {
        paymentId: payment._id,
        invoiceToken,
        checkoutUrl,
        amount: COTISATION_AMOUNT,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// POST /api/payment/webhook
// ========================

export const paymentWebhook = async (
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { data } = req.body;

    if (!data?.invoice?.token) {
      res.status(400).json({ success: false, message: 'Webhook invalide.' });
      return;
    }

    const invoiceToken: string = data.invoice.token;
    logger.info(`Webhook PayDunya reçu - Token: ${invoiceToken}`);

    // Répondre immédiatement à PayDunya (éviter les timeouts)
    res.status(200).json({ success: true });

    // Traitement asynchrone
    processWebhook(invoiceToken).catch((err) => {
      logger.error('Erreur traitement webhook :', err);
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// TRAITEMENT WEBHOOK
// ========================

const processWebhook = async (invoiceToken: string): Promise<void> => {
  // Vérifier le paiement auprès de PayDunya
  const paydunyaData = await verifyPaydunyaInvoice(invoiceToken);

  if (paydunyaData.status !== 'completed') {
    logger.info(`Paiement non complété : ${invoiceToken} - Status: ${paydunyaData.status}`);
    return;
  }

  // Trouver le paiement en BDD
  const payment = await Payment.findOne({ paydunyaInvoiceToken: invoiceToken });
  if (!payment) {
    logger.error(`Paiement introuvable pour le token : ${invoiceToken}`);
    return;
  }

  // Éviter le double traitement
  if (payment.status === PaymentStatus.COMPLETED) {
    logger.info(`Paiement déjà traité : ${payment._id}`);
    return;
  }

  // Mettre à jour le paiement
  await Payment.findByIdAndUpdate(payment._id, {
    status: PaymentStatus.COMPLETED,
    method: mapPaymentMethod(paydunyaData.paymentMethod) as PaymentMethod,
    paydunyaTransactionId: paydunyaData.transactionId,
    paidAt: new Date(),
  });

  // Récupérer le membre
  const member = await Member.findById(payment.member).populate<{
    user: { _id: string; name: string; email: string; phone: string; photo: string };
  }>('user');

  if (!member) {
    logger.error(`Membre introuvable pour le paiement : ${payment._id}`);
    return;
  }

  const user = member.user as { _id: string; name: string; email: string; phone: string; photo: string };

  // Calculer les dates
  const now = new Date();
  const expiryDate = calculateExpiryDate(now);

  // Activer / Renouveler le membre
  await Member.findByIdAndUpdate(member._id, {
    status: MemberStatus.ACTIVE,
    issueDate: member.issueDate || now,
    expiryDate,
    $inc: { renewalCount: member.status === MemberStatus.ACTIVE ? 1 : 0 },
  });

  logger.info(`Membre activé : ${member.memberNumber}`);

  // Générer la carte PDF
  let cardPdfUrl: string | undefined;
  try {
    const cardData = {
      memberNumber: member.memberNumber,
      memberName: user.name,
      memberPhoto: user.photo,
      issueDate: member.issueDate || now,
      expiryDate,
      status: 'active',
    };

    const generated = await generateMemberCardPDF(cardData);

    // Enregistrer la carte en BDD
    await Card.findOneAndUpdate(
      { member: member._id },
      {
        member: member._id,
        user: user._id,
        pdfUrl: generated.pdfUrl,
        pdfPublicId: generated.pdfPublicId,
        qrCodeUrl: generated.qrCodeUrl,
        qrCodeData: generated.qrCodeData,
        generatedAt: now,
        $inc: { version: 1 },
      },
      { upsert: true, new: true }
    );

    // Mettre à jour les URLs sur le membre
    await Member.findByIdAndUpdate(member._id, {
      cardUrl: generated.pdfUrl,
      qrCodeUrl: generated.qrCodeUrl,
    });

    cardPdfUrl = generated.pdfUrl;
    logger.info(`Carte générée : ${member.memberNumber}`);
  } catch (err) {
    logger.error('Erreur génération carte :', err);
  }

  // Notification en BDD
  await Notification.create({
    user: user._id,
    type: NotificationType.PAYMENT_SUCCESS,
    title: 'Paiement validé',
    message: `Votre cotisation de ${COTISATION_AMOUNT} FCFA a été validée. Carte ${member.memberNumber} active.`,
    metadata: { paymentId: payment._id, memberNumber: member.memberNumber },
  });

  if (cardPdfUrl) {
    await Notification.create({
      user: user._id,
      type: NotificationType.CARD_GENERATED,
      title: 'Carte membre générée',
      message: `Votre carte ${member.memberNumber} est disponible au téléchargement.`,
      metadata: { cardUrl: cardPdfUrl },
    });
  }

  // Envoyer l'email de confirmation
  await sendPaymentSuccessEmail(
    user.email,
    user.name,
    member.memberNumber,
    COTISATION_AMOUNT,
    paydunyaData.paymentMethod,
    paydunyaData.transactionId,
    expiryDate,
    cardPdfUrl
  );

  logger.info(`✅ Webhook traité avec succès : ${member.memberNumber}`);
};

// ========================
// GET /api/payment/status/:token
// ========================

export const getPaymentStatus = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { token } = req.params;

    const payment = await Payment.findOne({
      paydunyaInvoiceToken: token,
      user: req.user?.id,
    });

    if (!payment) throw createApiError('Paiement introuvable.', 404);

    res.status(200).json({
      success: true,
      message: 'Statut du paiement.',
      data: {
        status: payment.status,
        amount: payment.amount,
        paidAt: payment.paidAt,
        method: payment.method,
      },
    });
  } catch (error) {
    next(error);
  }
};
