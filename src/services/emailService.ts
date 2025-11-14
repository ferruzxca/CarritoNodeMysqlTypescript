import nodemailer from 'nodemailer';
import { env } from '../config/env';

export const transporter = nodemailer.createTransport({
  host: env.SMTP_HOST,
  port: env.SMTP_PORT,
  secure: env.SMTP_SECURE,
  auth: {
    user: env.SMTP_USER,
    pass: env.SMTP_PASS
  }
});

interface SendInvoiceOptions {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; path: string }[];
}

export const sendEmail = async ({ to, subject, html, attachments }: SendInvoiceOptions): Promise<void> => {
  await transporter.sendMail({
    from: env.MAIL_FROM,
    to,
    subject,
    html,
    attachments
  });
};
