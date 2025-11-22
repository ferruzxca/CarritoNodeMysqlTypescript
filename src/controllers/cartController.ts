import { Request, Response } from 'express';
import { prisma } from '../prisma';
import { z } from 'zod';
import { AuthenticatedRequest } from '../middleware/auth';
import { createInvoicePdf, ensureInvoiceDir } from '../utils/pdf';
import path from 'path';
import { sendEmail } from '../services/emailService';
import { Prisma } from '@prisma/client';
import { promises as fs } from 'fs';
import { sendWhatsAppInvoice } from '../services/whatsappService';
import { env } from '../config/env';

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)} MXN`;

type InvoiceLineItem = { name: string; quantity: number; priceCents: number };

const buildInvoiceEmail = ({
  orderId,
  totalCents,
  invoiceUrl,
  customerName,
  customerEmail,
  items
}: {
  orderId: string;
  totalCents: number;
  invoiceUrl: string;
  customerName: string;
  customerEmail: string;
  items: InvoiceLineItem[];
}): string => {
  const itemsHtml = items
    .map(
      (item, index) => `
        <tr style="background:${index % 2 === 0 ? '#0f172a' : '#0b1021'}">
          <td style="padding:10px 12px;color:#e2e8f0;font-weight:600;">${item.name}</td>
          <td style="padding:10px 12px;color:#cbd5e1;text-align:center;">x${item.quantity}</td>
          <td style="padding:10px 12px;color:#cbd5e1;text-align:center;">${formatCurrency(item.priceCents)}</td>
          <td style="padding:10px 12px;color:#09fbd3;text-align:right;font-weight:700;">${formatCurrency(
            item.priceCents * item.quantity
          )}</td>
        </tr>
      `
    )
    .join('');

  return `
    <div style="background:#0b1021;padding:24px;font-family:'Segoe UI',Arial,sans-serif;color:#e2e8f0;">
      <div style="max-width:720px;margin:0 auto;border:1px solid #1f2a44;border-radius:18px;overflow:hidden;">
        <div style="padding:22px 24px 18px;background:linear-gradient(120deg,#0b132b,#111827);">
          <div style="font-size:12px;color:#94a3b8;">Factura #${orderId}</div>
          <h1 style="margin:4px 0 6px;font-size:22px;color:#ffffff;">Hola ${customerName}, tu factura esta lista</h1>
          <p style="margin:0 0 12px;color:#cbd5e1;font-size:14px;">Incluimos el PDF foliado y el enlace seguro para consultarlo cuando quieras.</p>
          <a href="${invoiceUrl}" style="display:inline-block;padding:12px 18px;background:#ff2bff;color:#0b1021;border-radius:12px;font-weight:bold;text-decoration:none;">Descargar PDF</a>
        </div>
        <div style="padding:20px 24px;background:#0d1224;">
          <div style="display:flex;justify-content:space-between;align-items:center;padding:16px;border-radius:12px;background:rgba(9,251,211,0.06);border:1px solid rgba(9,251,211,0.25);">
            <div>
              <div style="font-size:12px;color:#9ca3af;">Total pagado</div>
              <div style="font-size:22px;font-weight:700;color:#e2e8f0;">${formatCurrency(totalCents)}</div>
            </div>
            <div style="text-align:right;">
              <div style="font-size:12px;color:#9ca3af;">Cliente</div>
              <div style="color:#e2e8f0;font-weight:600;">${customerName}</div>
              <div style="color:#9ca3af;font-size:12px;">${customerEmail}</div>
            </div>
          </div>
          <h3 style="margin:20px 0 10px;color:#e2e8f0;">Detalle de articulos</h3>
          <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;border:1px solid #1f2a44;border-radius:12px;overflow:hidden;">
            <thead>
              <tr style="background:#10172a;color:#cbd5e1;text-align:left;">
                <th style="padding:10px 12px;">Producto</th>
                <th style="padding:10px 12px;text-align:center;">Cantidad</th>
                <th style="padding:10px 12px;text-align:center;">Precio</th>
                <th style="padding:10px 12px;text-align:right;">Subtotal</th>
              </tr>
            </thead>
            <tbody>${itemsHtml}</tbody>
          </table>
        </div>
        <div style="padding:16px 24px;font-size:12px;color:#94a3b8;background:#0b1021;border-top:1px solid #1f2a44;">
          <p style="margin:0 0 8px;">Si necesitas ayuda responde a este correo. Gracias por comprar en Cyberpunk Neon Market.</p>
          <p style="margin:0;color:#09fbd3;">Folio ${orderId}</p>
        </div>
      </div>
    </div>
  `;
};

const addItemSchema = z.object({
  productId: z.string().min(1, 'Se requiere el identificador del producto.'),
  quantity: z.number().int().positive()
});

const updateItemSchema = z.object({
  quantity: z.number().int().min(0)
});

export const getOrCreateCart = async (req: Request): Promise<string> => {
  const ensureCartPersistence = async (cartId: string | undefined): Promise<string | null> => {
    if (!cartId) return null;
    const existingCart = await prisma.cart.findUnique({ where: { id: cartId } });
    return existingCart?.id ?? null;
  };

  const persistedCartId = await ensureCartPersistence(req.session.cartId);
  if (persistedCartId) {
    req.session.cartId = persistedCartId;
    return persistedCartId;
  }

  if (req.session.user?.id) {
    const userCart = await prisma.cart.findFirst({
      where: { userId: req.session.user.id },
      orderBy: { createdAt: 'desc' }
    });
    if (userCart) {
      req.session.cartId = userCart.id;
      return userCart.id;
    }
  }

  const cart = await prisma.cart.create({
    data: {
      sessionId: req.sessionID,
      userId: req.session.user?.id
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

export const shareInvoice = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { orderId } = z.object({ orderId: z.string().cuid() }).parse(req.params);
    const { method, phone, email } = z
      .object({
        method: z.enum(['email', 'whatsapp']),
        phone: z.string().optional(),
        email: z.string().email().optional()
      })
      .parse(req.body);

    if (!req.userId) {
      res.status(401).json({ message: 'Debes iniciar sesión para compartir la factura.' });
      return;
    }

    const order = await prisma.order.findFirst({
      where: { id: orderId, userId: req.userId },
      include: { user: true, items: { include: { product: true } } }
    });

    if (!order) {
      res.status(404).json({ message: 'No encontramos la factura solicitada.' });
      return;
    }

    const itemsWithNames = order.items.map((item) => ({ ...item, productName: item.product.name }));
    const invoiceFileName = `invoice-${order.id}.pdf`;
    const invoicePath = path.join(process.cwd(), 'storage', 'invoices', invoiceFileName);
    let invoiceUrl = order.invoiceUrl ?? `${env.APP_URL}/invoices/${invoiceFileName}`;

    const invoiceExists = await fs
      .access(invoicePath)
      .then(() => true)
      .catch(() => false);

    const { user: orderUser, items: _items, ...orderData } = order;
    if (!invoiceExists) {
      invoiceUrl = await createInvoicePdf({
        order: { ...orderData, items: itemsWithNames },
        user: { email: orderUser.email, name: orderUser.name }
      });
      await prisma.order.update({ where: { id: order.id }, data: { invoiceUrl } });
    }

    if (method === 'whatsapp') {
      if (!phone) {
        res.status(400).json({ message: 'Indica el número de WhatsApp con lada.' });
        return;
      }

      await sendWhatsAppInvoice({
        to: phone,
        invoiceUrl,
        orderId: order.id,
        totalCents: order.totalCents,
        customerName: order.user.name
      });

      res.status(200).json({ message: 'Factura enviada por WhatsApp.', invoiceUrl });
      return;
    }

    const targetEmail = email ?? order.user.email;
    const emailHtml = buildInvoiceEmail({
      orderId: order.id,
      totalCents: order.totalCents,
      invoiceUrl,
      customerName: order.user.name,
      customerEmail: targetEmail,
      items: itemsWithNames.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        priceCents: item.priceCents
      }))
    });

    await sendEmail({
      to: targetEmail,
      subject: 'Tu factura digital de Cyberpunk Neon Market',
      html: emailHtml,
      attachments: [{ filename: invoiceFileName, path: invoicePath }]
    });

    await prisma.invoice.updateMany({ where: { orderId: order.id }, data: { sentAt: new Date() } });

    res.status(200).json({ message: 'Factura reenviada por correo.', invoiceUrl });
  } catch (error) {
    if (error instanceof z.ZodError) {
      res.status(400).json({ message: 'Solicitud inválida', errors: error.errors });
      return;
    }
    console.error('Error al compartir factura', error);
    const message = error instanceof Error ? error.message : 'No se pudo compartir la factura.';
    res.status(500).json({ message });
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

    let emailSent = false;
    try {
      const emailHtml = buildInvoiceEmail({
        orderId: order.order.id,
        totalCents: order.order.totalCents,
        invoiceUrl,
        customerName: order.user.name,
        customerEmail: order.user.email,
        items: orderWithNames.items.map((item) => ({
          name: item.productName,
          quantity: item.quantity,
          priceCents: item.priceCents
        }))
      });

      await sendEmail({
        to: order.user.email,
        subject: 'Tu factura digital de Cyberpunk Neon Market',
        html: emailHtml,
        attachments: [{ filename: `invoice-${order.order.id}.pdf`, path: invoicePath }]
      });
      emailSent = true;
    } catch (emailError) {
      console.error('No se pudo enviar la factura por correo, se continuará con el flujo.', emailError);
    }

    await prisma.invoice.create({
      data: {
        orderId: order.order.id,
        pdfUrl: invoiceUrl,
        sentAt: emailSent ? new Date() : null
      }
    });

    await prisma.order.update({ where: { id: order.order.id }, data: { invoiceUrl } });

    const responseMessage = emailSent
      ? 'Pago realizado con éxito. Revisa tu correo para la factura.'
      : 'Pago realizado con éxito. No pudimos enviar la factura por correo, descárgala desde el enlace.';

    res.status(201).json({ message: responseMessage, orderId: order.order.id, invoiceUrl, emailSent });
  } catch (error) {
    console.error('Error en checkout', error);
    res.status(500).json({ message: 'No se pudo procesar el pago.' });
  }
};
