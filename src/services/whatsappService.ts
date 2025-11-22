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

const normalizeFrom = (value: string): string =>
  value.startsWith('whatsapp:') ? value : `whatsapp:${value}`;

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

  const from = normalizeFrom(env.TWILIO_WHATSAPP_FROM!);
  const toNormalized = normalizeNumber(to);

  console.log('================= TWILIO DEBUG =================');
  console.log('TWILIO_ACCOUNT_SID =', JSON.stringify(env.TWILIO_ACCOUNT_SID));
  console.log('FROM (env.TWILIO_WHATSAPP_FROM) =', JSON.stringify(env.TWILIO_WHATSAPP_FROM));
  console.log('FROM NORMALIZED =', JSON.stringify(from));
  console.log('TO ORIGINAL =', JSON.stringify(to));
  console.log('TO NORMALIZED =', JSON.stringify(toNormalized));
  console.log('INVOICE URL =', JSON.stringify(invoiceUrl));
  console.log('=================================================');

  try {
    const result = await twilioClient.messages.create({
      from,
      to: toNormalized,
      body,
      mediaUrl: [invoiceUrl]
    });

    console.log('TWILIO MESSAGE CREATED SID =', result.sid);
  } catch (error: any) {
    console.error('TWILIO ERROR STATUS =', error?.status);
    console.error('TWILIO ERROR CODE   =', error?.code);
    console.error('TWILIO ERROR MSG    =', error?.message);
    throw error;
  }
};
