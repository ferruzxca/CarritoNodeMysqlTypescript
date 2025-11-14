import { randomBytes } from 'crypto';

export const generateToken = (length = 48): string => {
  return randomBytes(length).toString('hex');
};
