import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { createInvoicePdf, ensureInvoiceDir } from '../utils/pdf';
import path from 'path';
import { sendEmail } from '../services/emailService';
import { Prisma } from '@prisma/client';

const addItemSchema = z.object({
  productId: z.string().cuid(),
  quantity: z.number().int().positive()
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0)
});

export const getOrCreateCart = async (req: Request): Promise<string> => {
  if (req.session.cartId) {
    return req.session.cartId;
  }

  const cart = await prisma.cart.create({
    data: {
      sessionId: req.sessionID
    }
  });

  req.session.cartId = cart.id;
  return cart.id;
};

export const getCart = async (req: Request, res: Response): Promise<void> => {
  const cartId = await getOrCreateCart(req);
  const cart = await prisma.cart.findUnique({
    where: { id: cartId },
    include: {
      items: {
        include: {
          product: {
            select: { name: true, imageUrl: true, priceCents: true, promotions: true }
          }
        }
      }
    }
  });

  res.status(200).json(cart);
};

export const addItemToCart = async (req: Request, res: Response): Promise<void> => {
  try {
    const payload = addItemSchema.parse(req.body);
    const cartId = await getOrCreateCart(req);

    const product = await prisma.product.findUnique({ where: { id: payload.productId } });
    if (!product) {
      res.status(404).json({ message: 'Producto no encontrado.' });
      return;
    }

    const existingItem = await prisma.cartItem.findFirst({
      where: {
        cartId,
        productId: payload.productId
      }
    });

    const priceCents = product.priceCents;

    if (existingItem) {
      const updated = await prisma.cartItem.update({
        where: { id: existingItem.id },
        data: { quantity: existingItem.quantity + payload.quantity }
      });
      res.status(200).json(updated);
      return;
    }

    const item = await prisma.cartItem.create({
      data: {
        cartId,
        productId: payload.productId,
        quantity: payload.quantity,
        priceCents
      }
    });

    res.status(201).json(item);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error al agregar al carrito', error);
    res.status(500).json({ message: 'No se pudo agregar al carrito.' });
  }
};

export const updateCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = z.object({ itemId: z.string().cuid() }).parse(req.params);
    const cartId = await getOrCreateCart(req);
    const payload = updateItemSchema.parse(req.body);

    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) {
      res.status(404).json({ message: 'Elemento no encontrado en tu carrito.' });
      return;
    }

    if (payload.quantity === 0) {
      await prisma.cartItem.delete({ where: { id: itemId } });
      res.status(204).send();
      return;
    }

    const updated = await prisma.cartItem.update({
      where: { id: itemId },
      data: { quantity: payload.quantity }
    });

    res.status(200).json(updated);
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Datos inválidos', errors: error.errors });
      return;
    }
    console.error('Error al actualizar item del carrito', error);
    res.status(500).json({ message: 'No se pudo actualizar el elemento.' });
  }
};

export const removeCartItem = async (req: Request, res: Response): Promise<void> => {
  try {
    const { itemId } = z.object({ itemId: z.string().cuid() }).parse(req.params);
    const cartId = await getOrCreateCart(req);
    const item = await prisma.cartItem.findUnique({ where: { id: itemId } });
    if (!item || item.cartId !== cartId) {
      res.status(404).json({ message: 'Elemento no encontrado en tu carrito.' });
      return;
    }
    await prisma.cartItem.delete({ where: { id: itemId } });
    res.status(204).send();
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Solicitud inválida', errors: error.errors });
      return;
    }
    console.error('Error eliminando item', error);
    res.status(500).json({ message: 'No se pudo eliminar el elemento.' });
  }
};

export const checkout = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const cartId = await getOrCreateCart(req);
    const cart = await prisma.cart.findUnique({
      where: { id: cartId },
      include: {
        items: {
          include: { product: true }
        }
      }
    });

    if (!cart || cart.items.length === 0) {
      res.status(400).json({ message: 'Tu carrito está vacío.' });
      return;
    }

    if (!req.userId) {
      res.status(401).json({ message: 'Debes iniciar sesión para proceder con el pago.' });
      return;
    }

    await ensureInvoiceDir();

    const order = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      const user = await tx.user.findUniqueOrThrow({ where: { id: req.userId } });
      const totalCents = cart.items.reduce(
        (acc: number, item: typeof cart.items[number]) => acc + item.priceCents * item.quantity,
        0
      );

      await tx.cart.update({ where: { id: cart.id }, data: { userId: user.id } });

      const createdOrder = await tx.order.create({
        data: {
          userId: user.id,
          cartId: cart.id,
          totalCents,
          status: 'PAID',
          items: {
            create: cart.items.map((item: (typeof cart.items)[number]) => ({
              productId: item.productId,
              quantity: item.quantity,
              priceCents: item.priceCents
            }))
          }
        },
        include: {
          items: true
        }
      });

      await tx.cartItem.deleteMany({ where: { cartId: cart.id } });

      return { order: createdOrder, user };
    });

    const orderWithNames = {
      ...order.order,
      items: await Promise.all(
        order.order.items.map(async (item: (typeof order.order.items)[number]) => {
          const product = await prisma.product.findUniqueOrThrow({ where: { id: item.productId } });
          return { ...item, productName: product.name };
        })
      )
    };

    const invoiceUrl = await createInvoicePdf({
      order: orderWithNames,
      user: { email: order.user.email, name: order.user.name }
    });

    const invoicePath = path.join(process.cwd(), 'storage', 'invoices', `invoice-${order.order.id}.pdf`);

    await sendEmail({
      to: order.user.email,
      subject: 'Tu factura futurista ha llegado',
      html: `
        <h1 style="color:#ff2bff;font-family:monospace;">Gracias por tu compra</h1>
        <p>Adjuntamos la factura electrónica de tu compra en Cyberpunk Neon Market.</p>
        <p>Total pagado: <strong>$${(order.order.totalCents / 100).toFixed(2)} MXN</strong></p>
      `,
      attachments: [{ filename: `invoice-${order.order.id}.pdf`, path: invoicePath }]
    });

    await prisma.invoice.create({
      data: {
        orderId: order.order.id,
        pdfUrl: invoiceUrl,
        sentAt: new Date()
      }
    });

    await prisma.order.update({ where: { id: order.order.id }, data: { invoiceUrl } });

    res.status(201).json({ message: 'Pago realizado con éxito.', orderId: order.order.id, invoiceUrl });
  } catch (error) {
    console.error('Error en checkout', error);
    res.status(500).json({ message: 'No se pudo procesar el pago.' });
  }
};
