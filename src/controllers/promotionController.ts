import { Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const promotionSchema = z.object({
  title: z.string().min(3),
  description: z.string().min(10),
  discountRate: z.number().min(0.01).max(0.9),
  productId: z.string().cuid().optional(),
  startsAt: z.string().datetime(),
  endsAt: z.string().datetime()
});

export const listPromotions = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const promotions = await prisma.promotion.findMany({
    where: { active: true, endsAt: { gt: new Date() } },
    include: { product: true }
  });
  res.status(200).json(promotions);
};

export const createPromotion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.role || req.role !== Role.SUPERADMIN) {
      res.status(403).json({ message: 'Solo los súper usuarios pueden crear promociones.' });
      return;
    }
    const payload = promotionSchema.parse(req.body);
    const promotion = await prisma.promotion.create({
      data: {
        ...payload,
        startsAt: new Date(payload.startsAt),
        endsAt: new Date(payload.endsAt)
      }
    });
    res.status(201).json(promotion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error creando promoción', error);
    res.status(500).json({ message: 'No se pudo crear la promoción.' });
  }
};

export const deactivatePromotion = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.role || req.role !== Role.SUPERADMIN) {
      res.status(403).json({ message: 'Solo los súper usuarios pueden desactivar promociones.' });
      return;
    }
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    const promotion = await prisma.promotion.update({
      where: { id },
      data: { active: false }
    });
    res.status(200).json(promotion);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Solicitud inválida', errors: error.errors });
      return;
    }
    console.error('Error desactivando promoción', error);
    res.status(500).json({ message: 'No se pudo desactivar la promoción.' });
  }
};
