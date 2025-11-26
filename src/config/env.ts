import { config } from 'dotenv';
import { z } from 'zod';

config();

const envSchema = z.object({
  DATABASE_URL: z.string().url(),
  SESSION_SECRET: z.string().min(32, 'SESSION_SECRET debe tener al menos 32 caracteres'),
  SMTP_HOST: z.string(),
  SMTP_PORT: z.string().transform((value) => {
    const port = Number(value);
    if (Number.isNaN(port) || port <= 0) {
      throw new Error('SMTP_PORT debe ser un número válido');
    }
    return port;
  }),
  SMTP_USER: z.string().email(),
  SMTP_PASS: z.string().min(8),
  SMTP_SECURE: z.string().transform((value) => value === 'true'),
  MAIL_FROM: z.string(),
  TWILIO_ACCOUNT_SID: z.string().optional(),
  TWILIO_AUTH_TOKEN: z.string().optional(),
  TWILIO_WHATSAPP_FROM: z.string().optional(),
  TELEGRAM_BOT_TOKEN: z.string().optional(),
  APP_URL: z.string().url().default('http://localhost:3000'),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development')
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Error al cargar variables de entorno', parsed.error.flatten().fieldErrors);
  throw new Error('Variables de entorno inválidas. Revisa tu archivo .env');
}

export const env = parsed.data;
