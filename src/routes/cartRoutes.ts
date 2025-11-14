import { Router } from 'express';
import { addItemToCart, checkout, getCart, removeCartItem, updateCartItem } from '../controllers/cartController';
import { requireAuth } from '../middleware/auth';

const router = Router();

router.get('/', getCart);
router.post('/items', addItemToCart);
router.patch('/items/:itemId', updateCartItem);
router.delete('/items/:itemId', removeCartItem);
router.post('/checkout', requireAuth, checkout);

export default router;
