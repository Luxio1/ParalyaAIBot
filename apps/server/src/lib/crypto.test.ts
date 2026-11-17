import { describe, expect, it } from 'vitest';
import { decryptSecret, deriveSecretsKey, encryptSecret } from './crypto';

const key = deriveSecretsKey('a'.repeat(48));

describe('chiffrement des secrets', () => {
  it("déchiffre ce qu'il a chiffré, avec un IV différent à chaque fois", () => {
    const first = encryptSecret('token-discord', key, 'discordToken');
    const second = encryptSecret('token-discord', key, 'discordToken');
    expect(first).not.toBe(second);
    expect(first).not.toContain('token-discord');
    expect(decryptSecret(first, key, 'discordToken')).toBe('token-discord');
  });

  it('refuse un chiffré modifié', () => {
    const [version, iv, tag, ciphertext] = encryptSecret('valeur', key, 'x').split('.');
    const flipped = Buffer.from(ciphertext ?? '', 'base64url');
    flipped[0] = (flipped[0] ?? 0) ^ 1;
    const tampered = [version, iv, tag, flipped.toString('base64url')].join('.');
    expect(() => decryptSecret(tampered, key, 'x')).toThrow();
  });

  it('refuse une autre clé ou un autre contexte', () => {
    const payload = encryptSecret('valeur', key, 'discordToken');
    expect(() =>
      decryptSecret(payload, deriveSecretsKey('b'.repeat(48)), 'discordToken'),
    ).toThrow();
    expect(() => decryptSecret(payload, key, 'geminiApiKey')).toThrow();
  });
});
