import { Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

const blogPostSchema = z.object({
  title: z.string().min(5),
  content: z.string().min(50),
  published: z.boolean().default(false)
});

export const listBlogPosts = async (_req: AuthenticatedRequest, res: Response): Promise<void> => {
  const posts = await prisma.blogPost.findMany({
    where: { published: true },
    orderBy: { createdAt: 'desc' },
    include: { author: { select: { name: true, avatarUrl: true } } }
  });
  res.status(200).json(posts);
};

export const createBlogPost = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.role || req.role !== Role.SUPERADMIN) {
      res.status(403).json({ message: 'Solo el súper usuario puede publicar en el blog de sugerencias.' });
      return;
    }
    const payload = blogPostSchema.parse(req.body);
    const post = await prisma.blogPost.create({
      data: {
        title: payload.title,
        content: payload.content,
        published: payload.published,
        authorId: req.userId!
      }
    });
    res.status(201).json(post);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error creando entrada del blog', error);
    res.status(500).json({ message: 'No se pudo crear la entrada.' });
  }
};
