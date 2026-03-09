// lib/crypto.ts
// AES-256-GCM encryption for sensitive credential storage.
// Key is loaded from APP_ENCRYPTION_KEY env var (32-byte hex string).

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;    // 96-bit IV for GCM
const TAG_LENGTH = 16;

function getKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error(
      'APP_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). ' +
      'Generate with: openssl rand -hex 32',
    );
  }
  return Buffer.from(hex, 'hex');
}

/**
 * Encrypt a plaintext string.
 * Returns base64-encoded: iv (12 bytes) + ciphertext + auth tag (16 bytes)
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, encrypted, tag]).toString('base64');
}

/**
 * Decrypt a base64-encoded ciphertext produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const data = Buffer.from(ciphertext, 'base64');
  const iv = data.subarray(0, IV_LENGTH);
  const tag = data.subarray(data.length - TAG_LENGTH);
  const encrypted = data.subarray(IV_LENGTH, data.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  return decipher.update(encrypted) + decipher.final('utf8');
}
