import { describe, expect, it } from 'vitest';
import { RateLimiter } from './rateLimiter';

describe('RateLimiter', () => {
  it('bloque au-delà du quota, une seule fois signalé, puis libère au fil de la période', () => {
    let now = 0;
    const limiter = new RateLimiter(() => now);
    const hit = () => limiter.hit('alice', 2, 30_000);

    expect(hit()).toEqual({ allowed: true });
    now = 10_000;
    expect(hit()).toEqual({ allowed: true });
    now = 12_000;
    expect(hit()).toEqual({ allowed: false, retryInMs: 18_000, firstBlock: true });
    expect(hit()).toEqual({ allowed: false, retryInMs: 18_000, firstBlock: false });

    // La première question sort de la période : une place se libère, la seconde compte encore.
    now = 30_001;
    expect(hit()).toEqual({ allowed: true });
    expect(hit()).toMatchObject({ allowed: false, firstBlock: true });
  });

  it('compte chaque personne séparément', () => {
    const limiter = new RateLimiter(() => 0);
    limiter.hit('alice', 1, 1000);
    expect(limiter.hit('bob', 1, 1000)).toEqual({ allowed: true });
  });
});
