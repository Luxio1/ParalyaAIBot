export type RateLimitResult =
  | { allowed: true }
  /** `firstBlock` : premier refus depuis la dernière question acceptée, à signaler une seule fois. */
  | { allowed: false; retryInMs: number; firstBlock: boolean };

interface Entry {
  /** Instants des questions acceptées encore dans la période. */
  times: number[];
  warned: boolean;
}

/**
 * Quota par personne sur une période glissante : seules les questions des `windowMs` dernières
 * millisecondes comptent. Les messages refusés ne prolongent pas le blocage.
 */
export class RateLimiter {
  readonly #entries = new Map<string, Entry>();

  constructor(private readonly now: () => number = Date.now) {}

  hit(key: string, max: number, windowMs: number): RateLimitResult {
    const now = this.now();
    const entry = this.#entries.get(key) ?? { times: [], warned: false };
    entry.times = entry.times.filter((time) => time > now - windowMs);
    this.#entries.set(key, entry);

    if (entry.times.length < max) {
      entry.times.push(now);
      entry.warned = false;
      return { allowed: true };
    }
    const oldest = entry.times[0] ?? now;
    const firstBlock = !entry.warned;
    entry.warned = true;
    return { allowed: false, retryInMs: oldest + windowMs - now, firstBlock };
  }

  /** Oublie les personnes sans question récente. */
  sweep(windowMs: number): void {
    const limit = this.now() - windowMs;
    for (const [key, entry] of this.#entries) {
      if (entry.times.every((time) => time <= limit)) this.#entries.delete(key);
    }
  }
}
