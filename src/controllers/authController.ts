import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { hashPassword, verifyPassword } from '../utils/password';
import { generateToken } from '../utils/token';
import { z } from 'zod';
import { env } from '../config/env';
import { Role } from '@prisma/client';

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(12, 'La contraseña debe contener al menos 12 caracteres.'),
  name: z.string().min(3),
  role: z.nativeEnum(Role).optional()
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8)
});

export const register = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = registerSchema.parse(req.body);
    const passwordHash = await hashPassword(data.password);

    const user = await prisma.user.create({
      data: {
        email: data.email.toLowerCase(),
        passwordHash,
        name: data.name,
        role: data.role ?? undefined
      }
    });

    res.status(201).json({
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    if ((error as { code?: string }).code === 'P2002') {
      res.status(409).json({ message: 'El correo ya se encuentra registrado.' });
      return;
    }
    console.error('Error en register', error);
    res.status(500).json({ message: 'Error inesperado al registrar usuario.' });
  }
};

export const login = async (req: Request, res: Response): Promise<void> => {
  try {
    const data = loginSchema.parse(req.body);
    const user = await prisma.user.findUnique({ where: { email: data.email.toLowerCase() } });

    if (!user) {
      res.status(401).json({ message: 'Credenciales inválidas.' });
      return;
    }

    const valid = await verifyPassword(data.password, user.passwordHash);
    if (!valid) {
      res.status(401).json({ message: 'Credenciales inválidas.' });
      return;
    }

    const token = generateToken(32);
    const expiresAt = new Date(Date.now() + 1000 * 60 * 60 * 8); // 8 horas

    await prisma.session.create({
      data: {
        token,
        expiresAt,
        userId: user.id
      }
    });

    req.session.user = {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name
    };
    req.session.cookie.maxAge = 1000 * 60 * 60 * 8;
    req.session.cookie.secure = env.NODE_ENV === 'production';

    res.status(200).json({
      message: 'Autenticación exitosa.',
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        name: user.name
      }
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error en login', error);
    res.status(500).json({ message: 'No se pudo iniciar sesión.' });
  }
};

export const logout = async (req: Request, res: Response): Promise<void> => {
  try {
    if (req.session.user) {
      await prisma.session.deleteMany({ where: { userId: req.session.user.id } });
    }
    req.session.destroy(() => undefined);
    res.clearCookie('connect.sid');
    res.status(200).json({ message: 'Sesión cerrada correctamente.' });
  } catch (error) {
    console.error('Error al cerrar sesión', error);
    res.status(500).json({ message: 'No se pudo cerrar sesión.' });
  }
};

export const currentUser = (req: Request, res: Response): void => {
  if (!req.session.user) {
    res.status(200).json({ user: null });
    return;
  }
  res.status(200).json({ user: req.session.user });
};
