import { Router } from 'express';
import { createReview } from '../controllers/reviewController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.post('/', requireAuth, createReview);

export default router;
