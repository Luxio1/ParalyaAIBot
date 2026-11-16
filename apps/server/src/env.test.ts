import { isAbsolute, join, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EnvError, parseEnv } from './env';

const SECRET = 'x'.repeat(48);
const ROOT = resolve('/tmp/projet');

describe('parseEnv', () => {
  it('applique les valeurs par défaut', () => {
    const env = parseEnv({ APP_SECRET: SECRET }, ROOT);
    expect(env.nodeEnv).toBe('development');
    expect(env.isProduction).toBe(false);
    expect(env.host).toBe('127.0.0.1');
    expect(env.port).toBe(3000);
    expect(env.dataDir).toBe(join(ROOT, 'data'));
    expect(env.databaseFile).toBe(join(ROOT, 'data', 'bot.db'));
    expect(env.geminiApiKey).toBeUndefined();
  });

  it('traite les variables vides comme absentes', () => {
    const env = parseEnv({ APP_SECRET: SECRET, PORT: '', GEMINI_API_KEY: '  ' }, ROOT);
    expect(env.port).toBe(3000);
    expect(env.geminiApiKey).toBeUndefined();
  });

  it('conserve un DATA_DIR absolu', () => {
    const dataDir = resolve('/data');
    const env = parseEnv({ APP_SECRET: SECRET, DATA_DIR: dataDir }, ROOT);
    expect(env.dataDir).toBe(dataDir);
    expect(isAbsolute(env.webDistDir)).toBe(true);
  });

  it('refuse un APP_SECRET absent ou trop court', () => {
    expect(() => parseEnv({}, ROOT)).toThrow(EnvError);
    expect(() => parseEnv({ APP_SECRET: 'trop-court' }, ROOT)).toThrow(/32 caractères/);
  });

  it('refuse un port invalide', () => {
    expect(() => parseEnv({ APP_SECRET: SECRET, PORT: 'abc' }, ROOT)).toThrow(/PORT/);
    expect(() => parseEnv({ APP_SECRET: SECRET, PORT: '70000' }, ROOT)).toThrow(/PORT/);
  });

  it('n’inclut jamais la valeur du secret dans le message d’erreur', () => {
    try {
      parseEnv({ APP_SECRET: 'secret-court' }, ROOT);
      expect.unreachable();
    } catch (error) {
      expect((error as Error).message).not.toContain('secret-court');
    }
  });
});
