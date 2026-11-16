import { describe, expect, it } from 'vitest';
import { logEntrySchema } from './logs';

describe('logEntrySchema', () => {
  it('accepte une entrée valide', () => {
    const entry = {
      id: '1',
      timestamp: new Date().toISOString(),
      type: 'discord',
      message: 'Bot connecté',
    };
    expect(logEntrySchema.parse(entry)).toEqual(entry);
  });

  it('rejette un type inconnu', () => {
    const result = logEntrySchema.safeParse({
      id: '1',
      timestamp: new Date().toISOString(),
      type: 'inconnu',
      message: '',
    });
    expect(result.success).toBe(false);
  });
});
