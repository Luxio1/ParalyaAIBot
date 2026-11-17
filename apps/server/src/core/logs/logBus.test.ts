import type { ServerEvent } from '@bot/shared';
import { describe, expect, it } from 'vitest';
import { LogBus } from './logBus';

describe('LogBus', () => {
  it('ne garde que les 500 dernières entrées', () => {
    const bus = new LogBus();
    for (let i = 1; i <= 501; i++) bus.push('system', `message ${i}`);
    const entries = bus.entries();
    expect(entries).toHaveLength(500);
    expect(entries[0]?.message).toBe('message 2');
    expect(entries.at(-1)?.message).toBe('message 501');
  });

  it("notifie les abonnés jusqu'à leur désabonnement", () => {
    const bus = new LogBus();
    const received: ServerEvent[] = [];
    const unsubscribe = bus.subscribe((event) => received.push(event));

    bus.push('discord', 'connecté');
    bus.clear();
    unsubscribe();
    bus.push('discord', 'ignoré');

    expect(received.map((event) => event.type)).toEqual(['log', 'logs:cleared']);
    expect(bus.entries()).toHaveLength(1);
  });
});
