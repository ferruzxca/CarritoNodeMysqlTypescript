import { Request, Response, NextFunction } from 'express';
import { Role } from '@prisma/client';

export interface AuthenticatedRequest extends Request {
  userId?: string;
  role?: Role;
}

export const requireAuth = (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
  if (!req.session.user) {
    res.status(401).json({ message: 'Debes iniciar sesión para acceder a esta función.' });
    return;
  }
  req.userId = req.session.user.id;
  req.role = req.session.user.role;
  next();
};

export const requireRole = (...roles: Role[]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.session.user || !roles.includes(req.session.user.role)) {
      res.status(403).json({ message: 'No tienes permisos suficientes.' });
      return;
    }
    req.userId = req.session.user.id;
    req.role = req.session.user.role;
    next();
  };
};
