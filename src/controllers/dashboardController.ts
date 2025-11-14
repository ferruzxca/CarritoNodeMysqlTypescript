import { Response } from 'express';
import { prisma } from '../prisma';
import { AuthenticatedRequest } from '../middleware/auth';
import { Role } from '@prisma/client';

export const getDashboardMetrics = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  if (!req.role || req.role !== Role.SUPERADMIN) {
    res.status(403).json({ message: 'Solo el súper usuario puede acceder al dashboard.' });
    return;
  }

  const [orders, topProducts, totalUsers] = await Promise.all([
    prisma.order.findMany({ select: { createdAt: true, totalCents: true } }),
    prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 5
    }),
    prisma.user.count()
  ]);

  const salesByMonthMap = new Map<string, number>();
  for (const order of orders) {
    const key = `${order.createdAt.getFullYear()}-${String(order.createdAt.getMonth() + 1).padStart(2, '0')}`;
    const prev = salesByMonthMap.get(key) ?? 0;
    salesByMonthMap.set(key, prev + order.totalCents);
  }

  const salesByMonth = Array.from(salesByMonthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([period, total]) => ({ period, total }));

  const productIds = topProducts.map((item) => item.productId);
  const productDetails = await prisma.product.findMany({
    where: { id: { in: productIds } },
    select: { id: true, name: true }
  });
  const productMap = new Map(productDetails.map((product) => [product.id, product.name]));
  const topProductsEnriched = topProducts.map((item) => ({
    productId: item.productId,
    productName: productMap.get(item.productId) ?? 'Producto misterioso',
    totalSold: item._sum.quantity ?? 0
  }));

  res.status(200).json({ salesByMonth, topProducts: topProductsEnriched, totalUsers });
};
