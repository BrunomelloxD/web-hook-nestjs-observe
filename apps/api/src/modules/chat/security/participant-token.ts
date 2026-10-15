import { createHash, randomBytes } from 'node:crypto';

/** Opaque participant token: 32 random bytes, base64url (43 chars, no "."). */
export function generateToken(): string {
  return randomBytes(32).toString('base64url');
}

/** Only this SHA-256 hex digest is stored; the raw token never is. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/** Key for the "one online participant per name" unique index. */
export function toNameKey(name: string): string {
  return name.normalize('NFC').toLowerCase();
}
