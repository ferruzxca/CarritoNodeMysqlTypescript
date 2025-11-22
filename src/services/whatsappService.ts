import twilio, { Twilio } from 'twilio';
import { env } from '../config/env';

const formatCurrency = (cents: number) => `$${(cents / 100).toFixed(2)} MXN`;

let client: Twilio | null = null;

const ensureClient = (): Twilio => {
  if (!env.TWILIO_ACCOUNT_SID || !env.TWILIO_AUTH_TOKEN || !env.TWILIO_WHATSAPP_FROM) {
    throw new Error(
      'WhatsApp no esta configurado. Define TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN y TWILIO_WHATSAPP_FROM.'
    );
  }

  if (!client) {
    client = twilio(env.TWILIO_ACCOUNT_SID, env.TWILIO_AUTH_TOKEN);
  }

  return client;
};

const normalizeNumber = (value: string): string => {
  const cleaned = value.replace(/\s+/g, '');
  return cleaned.startsWith('whatsapp:') ? cleaned : `whatsapp:${cleaned}`;
};

const normalizeFrom = (value: string): string => (value.startsWith('whatsapp:') ? value : `whatsapp:${value}`);

export const sendWhatsAppInvoice = async ({
  to,
  invoiceUrl,
  orderId,
  totalCents,
  customerName
}: {
  to: string;
  invoiceUrl: string;
  orderId: string;
  totalCents: number;
  customerName: string;
}): Promise<void> => {
  const twilioClient = ensureClient();
  const body = `Hola ${customerName || 'cliente'}! Tu factura ${orderId} por ${formatCurrency(
    totalCents
  )} esta lista. Descarga el PDF desde este mensaje.`;

  await twilioClient.messages.create({
    from: normalizeFrom(env.TWILIO_WHATSAPP_FROM!),
    to: normalizeNumber(to),
    body,
    mediaUrl: [invoiceUrl]
  });
};
