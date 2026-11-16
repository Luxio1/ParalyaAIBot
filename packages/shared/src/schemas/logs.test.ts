import { describe, expect, it } from 'vitest';
import { LOG_TYPE_LABELS, LOG_TYPES, logEntrySchema } from './logs';

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

  it('fournit un libellé français pour chaque type', () => {
    for (const type of LOG_TYPES) {
      expect(LOG_TYPE_LABELS[type]).toBeTruthy();
    }
  });
});
