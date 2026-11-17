import { LOG_BUFFER_SIZE, type LogEntry, type LogType, type ServerEvent } from '@bot/shared';

type LogEvent = Extract<ServerEvent, { type: 'log' | 'logs:cleared' }>;
type Listener = (event: LogEvent) => void;

/** Journal de la console du dashboard : les `LOG_BUFFER_SIZE` dernières entrées, en mémoire uniquement. */
export class LogBus {
  readonly #entries: LogEntry[] = [];
  readonly #listeners = new Set<Listener>();
  #nextId = 1;

  push(type: LogType, message: string): void {
    const entry: LogEntry = {
      id: String(this.#nextId++),
      timestamp: new Date().toISOString(),
      type,
      message,
    };
    this.#entries.push(entry);
    if (this.#entries.length > LOG_BUFFER_SIZE) this.#entries.shift();
    this.#emit({ type: 'log', entry });
  }

  entries(): LogEntry[] {
    return [...this.#entries];
  }

  clear(): void {
    this.#entries.length = 0;
    this.#emit({ type: 'logs:cleared' });
  }

  /** Renvoie la fonction de désabonnement. */
  subscribe(listener: Listener): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #emit(event: LogEvent): void {
    for (const listener of this.#listeners) listener(event);
  }
}
