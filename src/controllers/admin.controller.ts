import { Response, NextFunction } from 'express';
import { User } from '../models/User.model';
import { Member } from '../models/Member.model';
import { Payment } from '../models/Payment.model';
import { Card } from '../models/Card.model';
import { ActivityLog } from '../models/Log.model';
import { AuthRequest, MemberStatus, PaymentStatus, UserRole } from '../types';
import { createApiError } from '../middleware/error.middleware';
import { logger } from '../utils/logger';

// ========================
// GET /api/admin/members
// ========================

export const getAllMembers = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const search = req.query.search as string;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    // Construction du filtre utilisateurs
    const userFilter: Record<string, unknown> = { role: UserRole.MEMBER };
    if (search) {
      userFilter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
      ];
    }

    const users = await User.find(userFilter).select('-password -refreshToken');
    const userIds = users.map((u) => u._id);

    // Filtre membres
    const memberFilter: Record<string, unknown> = { user: { $in: userIds } };
    if (status) memberFilter.status = status;

    const total = await Member.countDocuments(memberFilter);
    const members = await Member.find(memberFilter)
      .populate('user', 'name email phone address photo createdAt isActive')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Liste des membres.',
      data: { members },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/admin/members/:id
// ========================

export const getMemberById = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findById(req.params.id).populate(
      'user',
      '-password -refreshToken'
    );
    if (!member) throw createApiError('Membre introuvable.', 404);

    const payments = await Payment.find({ member: member._id }).sort({ createdAt: -1 });
    const cards = await Card.find({ member: member._id }).sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Détail membre.',
      data: { member, payments, cards },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// PUT /api/admin/members/:id
// ========================

export const updateMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const { name, phone, address, isActive } = req.body;

    const member = await Member.findById(req.params.id).populate('user');
    if (!member) throw createApiError('Membre introuvable.', 404);

    const userId = (member.user as { _id: string })._id;

    if (name || phone || address || isActive !== undefined) {
      await User.findByIdAndUpdate(userId, {
        ...(name && { name }),
        ...(phone && { phone }),
        ...(address && { address }),
        ...(isActive !== undefined && { isActive }),
      });
    }

    await ActivityLog.create({
      actor: req.user!.id,
      actorRole: req.user!.role as UserRole,
      action: 'ADMIN_UPDATE_MEMBER',
      targetType: 'Member',
      target: member._id,
      details: req.body,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Membre mis à jour.' });
  } catch (error) {
    next(error);
  }
};

// ========================
// PUT /api/admin/members/:id/suspend
// ========================

export const suspendMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { status: MemberStatus.SUSPENDED },
      { new: true }
    );
    if (!member) throw createApiError('Membre introuvable.', 404);

    await ActivityLog.create({
      actor: req.user!.id,
      actorRole: req.user!.role as UserRole,
      action: 'ADMIN_SUSPEND_MEMBER',
      targetType: 'Member',
      target: member._id,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Membre suspendu.' });
  } catch (error) {
    next(error);
  }
};

// ========================
// PUT /api/admin/members/:id/reactivate
// ========================

export const reactivateMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findByIdAndUpdate(
      req.params.id,
      { status: MemberStatus.ACTIVE },
      { new: true }
    );
    if (!member) throw createApiError('Membre introuvable.', 404);

    await ActivityLog.create({
      actor: req.user!.id,
      actorRole: req.user!.role as UserRole,
      action: 'ADMIN_REACTIVATE_MEMBER',
      targetType: 'Member',
      target: member._id,
      ipAddress: req.ip,
    });

    res.status(200).json({ success: true, message: 'Membre réactivé.' });
  } catch (error) {
    next(error);
  }
};

// ========================
// DELETE /api/admin/members/:id
// ========================

export const deleteMember = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const member = await Member.findById(req.params.id);
    if (!member) throw createApiError('Membre introuvable.', 404);

    const userId = member.user;

    await Card.deleteMany({ member: member._id });
    await Payment.deleteMany({ member: member._id });
    await Member.findByIdAndDelete(member._id);
    await User.findByIdAndDelete(userId);

    await ActivityLog.create({
      actor: req.user!.id,
      actorRole: req.user!.role as UserRole,
      action: 'ADMIN_DELETE_MEMBER',
      targetType: 'Member',
      target: member._id,
      ipAddress: req.ip,
    });

    logger.warn(`Membre supprimé: ${member.memberNumber} par admin ${req.user?.email}`);

    res.status(200).json({ success: true, message: 'Membre supprimé définitivement.' });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/admin/payments
// ========================

export const getAllPayments = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const status = req.query.status as string;
    const skip = (page - 1) * limit;

    const filter: Record<string, unknown> = {};
    if (status) filter.status = status;

    const total = await Payment.countDocuments(filter);
    const payments = await Payment.find(filter)
      .populate('user', 'name email phone')
      .populate('member', 'memberNumber')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Historique des paiements.',
      data: { payments },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/admin/statistics
// ========================

export const getStatistics = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const startOfYear = new Date(now.getFullYear(), 0, 1);

    const [
      totalMembers,
      activeMembers,
      expiredMembers,
      suspendedMembers,
      pendingMembers,
      monthlyPayments,
      annualPayments,
      newMembersThisMonth,
      recentActivity,
    ] = await Promise.all([
      Member.countDocuments(),
      Member.countDocuments({ status: MemberStatus.ACTIVE }),
      Member.countDocuments({ status: MemberStatus.EXPIRED }),
      Member.countDocuments({ status: MemberStatus.SUSPENDED }),
      Member.countDocuments({ status: MemberStatus.PENDING }),
      Payment.aggregate([
        { $match: { status: PaymentStatus.COMPLETED, paidAt: { $gte: startOfMonth } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Payment.aggregate([
        { $match: { status: PaymentStatus.COMPLETED, paidAt: { $gte: startOfYear } } },
        { $group: { _id: null, total: { $sum: '$amount' }, count: { $sum: 1 } } },
      ]),
      Member.countDocuments({ createdAt: { $gte: startOfMonth } }),
      ActivityLog.find().sort({ createdAt: -1 }).limit(10).populate('actor', 'name email'),
    ]);

    // Revenus des 6 derniers mois
    const last6Months = await Payment.aggregate([
      {
        $match: {
          status: PaymentStatus.COMPLETED,
          paidAt: { $gte: new Date(now.getFullYear(), now.getMonth() - 5, 1) },
        },
      },
      {
        $group: {
          _id: { year: { $year: '$paidAt' }, month: { $month: '$paidAt' } },
          total: { $sum: '$amount' },
          count: { $sum: 1 },
        },
      },
      { $sort: { '_id.year': 1, '_id.month': 1 } },
    ]);

    res.status(200).json({
      success: true,
      message: 'Statistiques récupérées.',
      data: {
        members: {
          total: totalMembers,
          active: activeMembers,
          expired: expiredMembers,
          suspended: suspendedMembers,
          pending: pendingMembers,
          newThisMonth: newMembersThisMonth,
        },
        revenue: {
          monthly: monthlyPayments[0]?.total || 0,
          monthlyCount: monthlyPayments[0]?.count || 0,
          annual: annualPayments[0]?.total || 0,
          annualCount: annualPayments[0]?.count || 0,
        },
        last6Months,
        recentActivity,
      },
    });
  } catch (error) {
    next(error);
  }
};

// ========================
// GET /api/admin/activity-logs
// ========================

export const getActivityLogs = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 50;
    const skip = (page - 1) * limit;

    const total = await ActivityLog.countDocuments();
    const logs = await ActivityLog.find()
      .populate('actor', 'name email role')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      success: true,
      message: 'Journaux d\'activité.',
      data: { logs },
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  } catch (error) {
    next(error);
  }
};
