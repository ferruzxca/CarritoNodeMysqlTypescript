import { Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';

const reviewSchema = z.object({
  productId: z.string().cuid(),
  rating: z.number().min(1).max(5),
  comment: z.string().min(5)
});

export const createReview = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.userId) {
      res.status(401).json({ message: 'Debes iniciar sesión para dejar una reseña.' });
      return;
    }
    const payload = reviewSchema.parse(req.body);

    const review = await prisma.review.create({
      data: {
        productId: payload.productId,
        rating: payload.rating,
        comment: payload.comment,
        userId: req.userId
      },
      include: {
        user: { select: { name: true, avatarUrl: true } }
      }
    });

    res.status(201).json(review);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error creando reseña', error);
    res.status(500).json({ message: 'No se pudo crear la reseña.' });
  }
};
