import type { MemorySession } from '@bot/shared';
import type { AiTurn } from '../ai/aiProvider';

export interface SessionInfo {
  /** `dm:<utilisateur>` ou `guild:<salon>:<utilisateur>`. */
  id: string;
  kind: MemorySession['kind'];
  userName: string;
  channelName: string | null;
}

interface Session extends SessionInfo {
  turns: AiTurn[];
  lastActiveAt: number;
}

/**
 * Mémoire de conversation court terme, en RAM uniquement : rien n'est écrit sur le disque et tout
 * est oublié au redémarrage. La durée de rétention est passée à chaque appel, depuis les réglages.
 */
export class SessionStore {
  readonly #sessions = new Map<string, Session>();
  readonly #listeners = new Set<() => void>();

  constructor(private readonly now: () => number = Date.now) {}

  /** Messages encore en mémoire, du plus ancien au plus récent. */
  history(id: string, retentionMs: number): AiTurn[] {
    this.sweep(retentionMs);
    return [...(this.#sessions.get(id)?.turns ?? [])];
  }

  append(info: SessionInfo, turns: AiTurn[], maxMessages: number): void {
    const session = this.#sessions.get(info.id) ?? { ...info, turns: [], lastActiveAt: 0 };
    session.turns = keepLast([...session.turns, ...turns], maxMessages);
    session.lastActiveAt = this.now();
    // Le pseudo ou le nom du salon a pu changer depuis le début de la conversation.
    Object.assign(session, info);
    this.#sessions.set(info.id, session);
    this.#emit();
  }

  list(retentionMs: number): MemorySession[] {
    this.sweep(retentionMs);
    return [...this.#sessions.values()]
      .sort((a, b) => b.lastActiveAt - a.lastActiveAt)
      .map((session) => ({
        id: session.id,
        kind: session.kind,
        userName: session.userName,
        channelName: session.channelName,
        messageCount: session.turns.length,
        expiresAt: new Date(session.lastActiveAt + retentionMs).toISOString(),
      }));
  }

  /** Renvoie `false` si la conversation n'existait pas (ou plus). */
  remove(id: string): boolean {
    const removed = this.#sessions.delete(id);
    if (removed) this.#emit();
    return removed;
  }

  clear(): void {
    if (this.#sessions.size === 0) return;
    this.#sessions.clear();
    this.#emit();
  }

  /** Oublie les conversations inactives depuis plus de `retentionMs`. */
  sweep(retentionMs: number): void {
    const limit = this.now() - retentionMs;
    let removed = false;
    for (const [id, session] of this.#sessions) {
      if (session.lastActiveAt <= limit) removed = this.#sessions.delete(id) || removed;
    }
    if (removed) this.#emit();
  }

  /** Renvoie la fonction de désabonnement. */
  subscribe(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }
}

/** Les `max` derniers messages, en commençant par un message de l'utilisateur comme l'exige Gemini. */
function keepLast(turns: AiTurn[], max: number): AiTurn[] {
  const kept = turns.slice(-max);
  return kept[0]?.role === 'model' ? kept.slice(1) : kept;
}
