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
const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)} MXN`;

export const ensureInvoiceDir = async (): Promise<void> => {
  await fs.mkdir(INVOICE_DIR, { recursive: true });
};

export const createInvoicePdf = async ({ order, user }: InvoiceData): Promise<string> => {
  await ensureInvoiceDir();
  const fileName = `invoice-${order.id}.pdf`;
  const filePath = path.join(INVOICE_DIR, fileName);

  await new Promise<void>((resolve, reject) => {
    const doc = new PDFDocument({ margin: 48, size: 'A4' });
    const stream = createWriteStream(filePath);
    doc.pipe(stream);

    const accent = '#ff2bff';
    const cyan = '#09fbd3';
    const panel = '#0b1428';
    const muted = '#cbd5e1';
    const textPrimary = '#e2e8f0';

    const addHeader = () => {
      const gradient = doc.linearGradient(48, 48, doc.page.width - 48, 160);
      gradient.stop(0, '#0b142b').stop(1, '#111827');

      doc.save();
      doc.roundedRect(32, 32, doc.page.width - 64, 150, 14);
      doc.fill(gradient);
      doc.restore();

      doc
        .fillColor(textPrimary)
        .font('Helvetica-Bold')
        .fontSize(24)
        .text('Factura electronica', 52, 54);

      doc.font('Helvetica').fontSize(12).fillColor(muted).text('Cyberpunk Neon Market', 52, 84);

      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(accent)
        .text(`#${order.id}`, doc.page.width - 200, 54, { align: 'right' });

      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(muted)
        .text(`Fecha: ${new Date(order.createdAt).toLocaleString('es-MX')}`, doc.page.width - 200, 84, {
          align: 'right'
        });

      doc
        .text(`Cliente: ${user.name}`, doc.page.width - 200, 102, { align: 'right' })
        .text(`Correo: ${user.email}`, doc.page.width - 200, 120, { align: 'right' });
    };

    const addSummary = () => {
      const top = 200;
      const leftColumnX = 52;
      const rightColumnX = doc.page.width / 2 + 16;
      const columnWidth = doc.page.width / 2 - 80;

      doc.save();
      doc.roundedRect(32, top - 12, doc.page.width - 64, 120, 12);
      doc.lineWidth(1).strokeColor('#1f2a44').stroke();
      doc.restore();

      doc.font('Helvetica').fontSize(10).fillColor(muted).text('Datos del cliente', leftColumnX, top);
      doc.font('Helvetica-Bold').fontSize(14).fillColor(textPrimary).text(user.name, leftColumnX, top + 16, {
        width: columnWidth
      });
      doc.font('Helvetica').fontSize(11).fillColor(muted).text(user.email, leftColumnX, top + 36, {
        width: columnWidth
      });
      doc.text(`Folio: ${order.id}`, leftColumnX, top + 54, { width: columnWidth });

      doc.font('Helvetica').fontSize(10).fillColor(muted).text('Resumen de pago', rightColumnX, top);
      doc
        .font('Helvetica-Bold')
        .fontSize(13)
        .fillColor(textPrimary)
        .text('Pago confirmado', rightColumnX, top + 14, { width: columnWidth, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(11)
        .fillColor(muted)
        .text(`Total pagado: ${formatCurrency(order.totalCents)}`, rightColumnX, top + 34, {
          width: columnWidth,
          align: 'right'
        });
      doc
        .text('Metodo: Pasarela segura en linea', rightColumnX, top + 50, { width: columnWidth, align: 'right' })
        .fillColor(cyan)
        .text('Factura disponible en PDF adjunto', rightColumnX, top + 70, { width: columnWidth, align: 'right' });
    };

    const addItemsTable = () => {
      const startY = 340;
      const columnProduct = 52;
      const columnQty = 300;
      const columnPrice = 380;
      const columnSubtotal = doc.page.width - 120;

      doc.font('Helvetica-Bold').fontSize(14).fillColor(textPrimary).text('Detalle de productos', columnProduct, startY);
      let y = startY + 22;

      doc.font('Helvetica').fontSize(10).fillColor(muted);
      doc.text('Producto', columnProduct, y);
      doc.text('Cantidad', columnQty, y);
      doc.text('Precio unitario', columnPrice, y, { width: 80 });
      doc.text('Subtotal', columnSubtotal, y, { width: 80, align: 'right' });
      y += 14;

      order.items.forEach((item: (typeof order.items)[number], index: number) => {
        const rowHeight = 26;
        if (index % 2 === 0) {
          doc.save();
          doc.roundedRect(42, y - 6, doc.page.width - 84, rowHeight, 6);
          doc.fill(panel);
          doc.restore();
        }

        doc.font('Helvetica-Bold').fontSize(11).fillColor(textPrimary).text(item.productName, columnProduct, y, {
          width: 230
        });
        doc.font('Helvetica').fontSize(11).fillColor(muted).text(`x${item.quantity}`, columnQty, y, { width: 60 });
        doc.text(formatCurrency(item.priceCents), columnPrice, y, { width: 80 });
        doc
          .font('Helvetica-Bold')
          .fillColor(cyan)
          .text(formatCurrency(item.priceCents * item.quantity), columnSubtotal, y, { width: 90, align: 'right' });

        y += rowHeight;
      });

      return y;
    };

    const addTotals = (offsetY: number) => {
      const boxHeight = 110;
      const boxY = offsetY + 18;

      doc.save();
      doc.roundedRect(32, boxY, doc.page.width - 64, boxHeight, 12);
      doc.fill(panel);
      doc.restore();

      const labelX = 52;
      const rightX = doc.page.width - 220;
      const itemsCount = order.items.reduce((acc, item) => acc + item.quantity, 0);

      doc.font('Helvetica').fontSize(10).fillColor(muted).text('Total pagado', labelX, boxY + 16);
      doc.font('Helvetica-Bold').fontSize(22).fillColor(textPrimary).text(formatCurrency(order.totalCents), labelX, boxY + 30);
      doc.font('Helvetica').fontSize(11).fillColor(muted).text('Gracias por tu compra.', labelX, boxY + 58);

      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(muted)
        .text('Articulos en tu pedido', rightX, boxY + 16, { width: 160, align: 'right' });
      doc
        .font('Helvetica-Bold')
        .fontSize(18)
        .fillColor(accent)
        .text(`${itemsCount}`, rightX, boxY + 30, { width: 160, align: 'right' });
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(muted)
        .text('Factura foliada y sellada digitalmente', rightX, boxY + 52, { width: 160, align: 'right' });
    };

    const addFooter = (offsetY: number) => {
      const footerY = offsetY + 150;
      doc
        .font('Helvetica')
        .fontSize(10)
        .fillColor(muted)
        .text(
          'Este comprobante incluye tu folio digital y el enlace seguro al PDF. Conserva este documento para referencia o garantias.',
          52,
          footerY,
          { width: doc.page.width - 104, align: 'center' }
        );
      doc.moveDown();
      doc.fillColor(cyan).font('Helvetica-Bold').text('Cyberpunk Neon Market', { align: 'center' });
    };

    addHeader();
    addSummary();
    const tableEndY = addItemsTable();
    addTotals(tableEndY);
    addFooter(tableEndY);

    doc.end();

    stream.on('finish', () => resolve());
    stream.on('error', (error) => reject(error));
  });

  return `${env.APP_URL}/invoices/${fileName}`;
};
