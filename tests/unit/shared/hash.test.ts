import { describe, expect, test } from 'vitest';
import { comparePassword, hashPassword } from '../../../src/shared/utils/hash';

describe('Hash Utils Unit Tests', () => {
  test('hashPassword should generate bcrypt hash and comparePassword should validate it', async () => {
    const raw = 'my-secret-password';
    const hash = await hashPassword(raw);

    expect(hash).toMatch(/^\$2[aby]\$/);
    await expect(comparePassword(raw, hash)).resolves.toBe(true);
  });

  test('comparePassword should return false for invalid password', async () => {
    const hash = await hashPassword('correct-password');
    await expect(comparePassword('wrong-password', hash)).resolves.toBe(false);
  });
});
