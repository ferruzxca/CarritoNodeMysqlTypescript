import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { Prisma, Role } from '@prisma/client';

const createProductSchema = z.object({
  name: z.string().min(3),
  slug: z.string().min(3),
  description: z.string().min(20),
  priceCents: z.number().int().positive(),
  imageUrl: z.string().url(),
  stock: z.number().int().nonnegative().default(0),
  category: z.string().min(3),
  tags: z.array(z.string()).default([]),
  vendorId: z.string().cuid().optional()
});

const updateProductSchema = createProductSchema.partial();

const filterSchema = z.object({
  category: z.string().optional(),
  minPrice: z.string().transform((value) => Number(value)).optional(),
  maxPrice: z.string().transform((value) => Number(value)).optional(),
  q: z.string().optional(),
  tag: z.string().optional()
});

export const listProducts = async (req: Request, res: Response): Promise<void> => {
  const params = filterSchema.safeParse(req.query);
  if (!params.success) {
    res.status(400).json({ message: 'Filtros inválidos', errors: params.error.flatten() });
    return;
  }

  const { category, minPrice, maxPrice, q, tag } = params.data;
  const where: Prisma.ProductWhereInput = {};

  if (category) {
    where.category = category;
  }
  if (typeof minPrice === 'number' && !Number.isNaN(minPrice)) {
    const existingFilter =
      typeof where.priceCents === 'object' && where.priceCents !== null ? where.priceCents : undefined;
    where.priceCents = { ...(existingFilter ?? {}), gte: Math.round(minPrice * 100) };
  }
  if (typeof maxPrice === 'number' && !Number.isNaN(maxPrice)) {
    const existingFilter =
      typeof where.priceCents === 'object' && where.priceCents !== null ? where.priceCents : undefined;
    where.priceCents = { ...(existingFilter ?? {}), lte: Math.round(maxPrice * 100) };
  }
  if (q) {
    const normalizedQuery = q.trim();
    const normalizedTagTerm = normalizedQuery.toLowerCase();
    where.OR = [
      { name: { contains: normalizedQuery } },
      { description: { contains: normalizedQuery } },
      { tags: { array_contains: normalizedTagTerm } }
    ];
  }
  if (tag) {
    where.tags = { array_contains: tag.toLowerCase() };
  }

  const products = await prisma.product.findMany({
    where,
    include: {
      promotions: { where: { active: true } }
    },
    orderBy: { createdAt: 'desc' }
  });

  if (products.length === 0) {
    res.status(200).json([]);
    return;
  }

  const productIds = products.map((product) => product.id);
  const reviews = await prisma.review.findMany({
    where: { productId: { in: productIds } },
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      rating: true,
      comment: true,
      productId: true,
      createdAt: true,
      user: { select: { name: true, avatarUrl: true } }
    }
  });

  type ReviewWithFallback = (typeof reviews)[number] & { user: { name: string; avatarUrl: string | null } };

  const reviewsByProduct = new Map<string, ReviewWithFallback[]>();
  for (const review of reviews) {
    const user = review.user ?? { name: 'Usuario desconocido', avatarUrl: null };
    const entry = reviewsByProduct.get(review.productId) ?? [];
    entry.push({ ...review, user });
    reviewsByProduct.set(review.productId, entry);
  }

  const hydratedProducts = products.map((product) => ({
    ...product,
    reviews: reviewsByProduct.get(product.id) ?? []
  }));

  res.status(200).json(hydratedProducts);
};

export const autocompleteProducts = async (req: Request, res: Response): Promise<void> => {
  const query = z.string().min(1).safeParse(req.query.q);
  if (!query.success) {
    res.status(200).json([]);
    return;
  }

  const searchTerm = query.data.toLowerCase();

  const products = await prisma.product.findMany({
    where: {
      name: { contains: searchTerm }
    },
    select: { id: true, name: true, slug: true },
    take: 8
  });

  res.status(200).json(products);
};

export const createProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const allowedRoles: Role[] = [Role.SUPERADMIN, Role.VENDOR];
    if (!req.role || !allowedRoles.includes(req.role)) {
      res.status(403).json({ message: 'No tienes permisos para crear productos.' });
      return;
    }

    const payload = createProductSchema.parse(req.body);
    const { vendorId: payloadVendorId, tags, ...productData } = payload;

    const vendorId = req.role === Role.VENDOR ? req.userId : payloadVendorId;
    const normalizedTags = tags.map((tagValue) => tagValue.toLowerCase());

    const product = await prisma.product.create({
      data: {
        ...productData,
        tags: normalizedTags,
        vendorId
      }
    });

    res.status(201).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ message: 'Ya existe un producto con ese slug.' });
      return;
    }
    console.error('Error creando producto', error);
    res.status(500).json({ message: 'No se pudo crear el producto.' });
  }
};

export const updateProduct = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { id } = z.object({ id: z.string().cuid() }).parse(req.params);
    const payload = updateProductSchema.parse(req.body);

    const product = await prisma.product.findUnique({ where: { id } });
    if (!product) {
      res.status(404).json({ message: 'Producto no encontrado.' });
      return;
    }

    if (req.role === Role.VENDOR && product.vendorId !== req.userId) {
      res.status(403).json({ message: 'No puedes modificar productos de otros vendedores.' });
      return;
    }

    const normalizedPayload =
      payload.tags && payload.tags.length > 0
        ? { ...payload, tags: payload.tags.map((tagValue) => tagValue.toLowerCase()) }
        : payload;

    const data = req.role === Role.VENDOR ? { ...normalizedPayload, vendorId: product.vendorId } : normalizedPayload;

    const updated = await prisma.product.update({ where: { id }, data });
    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error actualizando producto', error);
    res.status(500).json({ message: 'No se pudo actualizar el producto.' });
  }
};

export const getProduct = async (req: Request, res: Response): Promise<void> => {
  try {
    const { slug } = z.object({ slug: z.string() }).parse(req.params);
    const product = await prisma.product.findUnique({
      where: { slug },
      include: {
        promotions: { where: { active: true } },
        reviews: {
          include: { user: { select: { name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' }
        }
      }
    });

    if (!product) {
      res.status(404).json({ message: 'Producto no encontrado.' });
      return;
    }

    res.status(200).json(product);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Solicitud inválida', errors: error.errors });
      return;
    }
    console.error('Error obteniendo producto', error);
    res.status(500).json({ message: 'No se pudo obtener el producto.' });
  }
};
