import TelegramBot from 'node-telegram-bot-api';
import { createReadStream, promises as fs } from 'fs';
import path from 'path';
import { env } from '../config/env';

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)} MXN`;

let bot: TelegramBot | null = null;

const getBot = (): TelegramBot => {
  if (!env.TELEGRAM_BOT_TOKEN) {
    throw new Error('Telegram no esta configurado. Define TELEGRAM_BOT_TOKEN en tus variables de entorno.');
  }

  if (!bot) {
    bot = new TelegramBot(env.TELEGRAM_BOT_TOKEN, { polling: false });
  }

  return bot;
};

const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
};

interface SendTelegramInvoiceParams {
  chatId: string;
  invoiceUrl: string;
  orderId: string;
  totalCents: number;
  customerName: string;
  invoicePath?: string;
  invoiceFileName?: string;
}

export const sendTelegramInvoice = async ({
  chatId,
  invoiceUrl,
  orderId,
  totalCents,
  customerName,
  invoicePath,
  invoiceFileName
}: SendTelegramInvoiceParams): Promise<void> => {
  const botClient = getBot();

  const caption = `Hola ${customerName || 'cliente'}! Tu factura ${orderId} por ${formatCurrency(
    totalCents
  )} esta lista. Puedes abrir o descargar el PDF desde este chat.`;

  const fileName =
    invoiceFileName ?? (invoicePath ? path.basename(invoicePath) : `invoice-${orderId}.pdf`);

  let document: string | NodeJS.ReadableStream | Buffer = invoiceUrl;
  let fileOptions: TelegramBot.FileOptions | undefined;

  if (invoicePath && (await fileExists(invoicePath))) {
    document = createReadStream(invoicePath);
    fileOptions = {
      filename: fileName,
      contentType: 'application/pdf'
    };
  }

  try {
    await botClient.sendDocument(chatId, document as any, { caption }, fileOptions);
  } catch (error) {
    console.error('Error al enviar factura por Telegram', error);
    throw error;
  }
};