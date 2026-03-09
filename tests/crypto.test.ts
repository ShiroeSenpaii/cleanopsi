// tests/crypto.test.ts
import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.APP_ENCRYPTION_KEY = 'a'.repeat(64); // test key
});

describe('Encryption round-trip', () => {
  it('encrypts and decrypts a string correctly', async () => {
    const { encrypt, decrypt } = await import('../lib/crypto');
    const plaintext = 'ACxxxxxxxxxxxxxxxx:secret_token_here';
    const ciphertext = encrypt(plaintext);
    expect(ciphertext).not.toBe(plaintext);
    expect(decrypt(ciphertext)).toBe(plaintext);
  });

  it('produces different ciphertext each time (random IV)', async () => {
    const { encrypt } = await import('../lib/crypto');
    const plaintext = 'same_input';
    const c1 = encrypt(plaintext);
    const c2 = encrypt(plaintext);
    expect(c1).not.toBe(c2);
  });
});
