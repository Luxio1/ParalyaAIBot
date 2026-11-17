import { botConfigSchema, DEFAULT_BOT_CONFIG, type BotConfig } from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { BOT_SETTINGS_ID, botSettings } from '../db/schema';

/**
 * Réglages du bot, gardés en mémoire et relus à chaque message : une modification s'applique
 * au message suivant, sans reconnexion.
 */
export class ConfigService {
  #config: BotConfig;
  readonly #listeners = new Set<(previous: BotConfig, next: BotConfig) => void>();

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
  ) {
    const row = db.select().from(botSettings).where(eq(botSettings.id, BOT_SETTINGS_ID)).get();
    const stored = typeof row?.config === 'object' ? row.config : {};
    // Les réglages ajoutés par une version plus récente prennent leur valeur par défaut.
    const parsed = botConfigSchema.safeParse({ ...DEFAULT_BOT_CONFIG, ...stored });
    if (!parsed.success) {
      logBus.push('error', 'Réglages du bot illisibles : valeurs par défaut utilisées.');
    }
    this.#config = parsed.data ?? DEFAULT_BOT_CONFIG;
  }

  get(): BotConfig {
    return this.#config;
  }

  update(config: BotConfig): void {
    this.db
      .insert(botSettings)
      .values({ id: BOT_SETTINGS_ID, config })
      .onConflictDoUpdate({ target: botSettings.id, set: { config, updatedAt: new Date() } })
      .run();
    const previous = this.#config;
    this.#config = config;
    this.logBus.push('system', 'Réglages du bot enregistrés.');
    for (const listener of this.#listeners) listener(previous, config);
  }

  /** Renvoie la fonction de désabonnement. */
  onChange(listener: (previous: BotConfig, next: BotConfig) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }
}
