import { Router } from 'express';
import { createBlogPost, listBlogPosts } from '../controllers/blogController';
import { requireAuth, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', listBlogPosts);
router.post('/', requireAuth, requireRole(Role.SUPERADMIN), createBlogPost);

export default router;
