import PDFDocument from 'pdfkit';
import { Order, OrderItem, User } from '@prisma/client';
import { createWriteStream, promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env';

interface InvoiceData {
  order: Order & { items: (OrderItem & { productName: string })[] };
  user: Pick<User, 'email' | 'name'>;
}

const INVOICE_DIR = path.join(process.cwd(), 'storage', 'invoices');

export const ensureInvoiceDir = async (): Promise<void> => {
  await fs.mkdir(INVOICE_DIR, { recursive: true });
};

export const createInvoicePdf = async ({ order, user }: InvoiceData): Promise<string> => {
  await ensureInvoiceDir();
  const fileName = `invoice-${order.id}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 50 });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    doc
      .fillColor('#ff2bff')
      .fontSize(26)
      .text('Cyberpunk Neon Market', { align: 'center' })
      .moveDown();

    doc
      .fillColor('#09fbd3')
      .fontSize(16)
      .text(`Factura: ${order.id}`)
      .text(`Cliente: ${user.name} (${user.email})`)
      .text(`Fecha: ${new Date(order.createdAt).toLocaleString('es-MX')}`)
      .moveDown();

    doc
      .fillColor('#fff')
      .fontSize(14)
      .text('Detalle de compra:', { underline: true })
      .moveDown(0.5);

    order.items.forEach((item: (typeof order.items)[number]) => {
      const subtotal = (item.priceCents * item.quantity) / 100;
      doc.fillColor('#f8f8f8').text(`- ${item.productName} x${item.quantity}: $${subtotal.toFixed(2)} MXN`);
    });

    doc.moveDown();
    doc
      .fillColor('#ff2bff')
      .fontSize(18)
      .text(`Total: $${(order.totalCents / 100).toFixed(2)} MXN`, { align: 'right' })
      .moveDown();

    doc
      .fontSize(12)
      .fillColor('#9fa6ff')
      .text('Gracias por comprar en nuestro mercado neon. Sigue explorando las ofertas en nuestro dashboard futurista.', {
        align: 'center'
      });

    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', (error) => reject(error));
  });

  return `${env.APP_URL}/invoices/${fileName}`;
};
