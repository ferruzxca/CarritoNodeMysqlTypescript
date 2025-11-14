import { Router } from 'express';
import { getDashboardMetrics } from '../controllers/dashboardController';
import { requireAuth, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', requireAuth, requireRole(Role.SUPERADMIN), getDashboardMetrics);

export default router;
