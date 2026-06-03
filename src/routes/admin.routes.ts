import { Router } from 'express';
import {
  getAllMembers,
  getMemberById,
  updateMember,
  suspendMember,
  reactivateMember,
  deleteMember,
  getAllPayments,
  getStatistics,
  getActivityLogs,
} from '../controllers/admin.controller';
import { authenticate, adminOnly } from '../middleware/auth.middleware';
import { auditLog } from '../middleware/validate.middleware';

const router = Router();

// Toutes les routes admin nécessitent authentification + rôle admin
router.use(authenticate, adminOnly);

// Statistiques
router.get('/statistics', getStatistics);
router.get('/activity-logs', getActivityLogs);

// Gestion des membres
router.get('/members', getAllMembers);
router.get('/members/:id', getMemberById);
router.put('/members/:id', auditLog('ADMIN_UPDATE_MEMBER', 'Member'), updateMember);
router.put('/members/:id/suspend', auditLog('ADMIN_SUSPEND_MEMBER', 'Member'), suspendMember);
router.put('/members/:id/reactivate', auditLog('ADMIN_REACTIVATE_MEMBER', 'Member'), reactivateMember);
router.delete('/members/:id', auditLog('ADMIN_DELETE_MEMBER', 'Member'), deleteMember);

// Gestion des paiements
router.get('/payments', getAllPayments);

export default router;
