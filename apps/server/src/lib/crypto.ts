import { createCipheriv, createDecipheriv, hkdfSync, randomBytes } from 'node:crypto';

const FORMAT_VERSION = 'v1';
const ALGORITHM = 'aes-256-gcm';

/** Dérive la clé de chiffrement des secrets depuis `APP_SECRET` (HKDF-SHA256). */
export function deriveSecretsKey(appSecret: string): Buffer {
  return Buffer.from(hkdfSync('sha256', appSecret, '', 'paralya/secrets/v1', 32));
}

/**
 * Renvoie `v1.<iv>.<tag>.<chiffré>` en base64url.
 * `context` est authentifié sans être stocké : un chiffré copié vers un autre secret ne se déchiffre pas.
 */
export function encryptSecret(plaintext: string, key: Buffer, context: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv).setAAD(Buffer.from(context));
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return [FORMAT_VERSION, iv, cipher.getAuthTag(), ciphertext]
    .map((part) => (typeof part === 'string' ? part : part.toString('base64url')))
    .join('.');
}

/** Lève une erreur si la clé, le contexte ou le chiffré ne correspondent pas. */
export function decryptSecret(payload: string, key: Buffer, context: string): string {
  const [version, iv, tag, ciphertext] = payload.split('.');
  if (version !== FORMAT_VERSION || !iv || !tag || ciphertext === undefined) {
    throw new Error('Format de secret chiffré inconnu.');
  }
  const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'base64url'))
    .setAAD(Buffer.from(context))
    .setAuthTag(Buffer.from(tag, 'base64url'));
  return Buffer.concat([
    decipher.update(Buffer.from(ciphertext, 'base64url')),
    decipher.final(),
  ]).toString('utf8');
}
