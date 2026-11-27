import crypto from 'crypto';

// Без похожих символов 0/O и 1/I (раздел 10.6)
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateTicketNumber(): string {
  const bytes = crypto.randomBytes(8);
  let code = '';
  for (const b of bytes) code += ALPHABET[b % ALPHABET.length];
  return `TTX-${code}`;
}
