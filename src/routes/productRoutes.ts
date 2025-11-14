import { Router } from 'express';
import { autocompleteProducts, createProduct, getProduct, listProducts, updateProduct } from '../controllers/productController';
import { requireAuth, requireRole } from '../middleware/auth';
import { Role } from '@prisma/client';

const router = Router();

router.get('/', listProducts);
router.get('/search', autocompleteProducts);
router.get('/:slug', getProduct);
router.post('/', requireAuth, requireRole(Role.SUPERADMIN, Role.VENDOR), createProduct);
router.patch('/:id', requireAuth, requireRole(Role.SUPERADMIN, Role.VENDOR), updateProduct);

export default router;
