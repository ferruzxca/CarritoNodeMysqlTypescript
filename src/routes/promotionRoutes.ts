import { Router } from 'express';
import { createPromotion, deactivatePromotion, listPromotions } from '../controllers/promotionController';
import { requireAuth, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', listPromotions);
router.post('/', requireAuth, requireRole(Role.SUPERADMIN), createPromotion);
router.post('/:id/deactivate', requireAuth, requireRole(Role.SUPERADMIN), deactivatePromotion);

export default router;
