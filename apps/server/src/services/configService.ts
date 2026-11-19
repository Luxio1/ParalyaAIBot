import {
  botConfigSchema,
  DEFAULT_BOT_CONFIG,
  PROFILE_FIELDS,
  type BotConfig,
  type ProfileBehavior,
} from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { BOT_SETTINGS_ID, botSettings } from '../db/schema';
import type { ProfileService } from './profileService';

/**
 * Réglages du bot, gardés en mémoire et relus à chaque message : une modification s'applique
 * au message suivant, sans reconnexion. Les réglages `PROFILE_FIELDS` viennent du profil actif,
 * les autres sont communs à tous les profils.
 */
export class ConfigService {
  #shared: Partial<BotConfig>;
  #config: BotConfig;
  readonly #listeners = new Set<(previous: BotConfig, next: BotConfig) => void>();

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
    private readonly profiles: ProfileService,
  ) {
    const row = db.select().from(botSettings).where(eq(botSettings.id, BOT_SETTINGS_ID)).get();
    this.#shared = typeof row?.config === 'object' ? (row.config as Partial<BotConfig>) : {};
    this.#config = this.#compute();
    // Changer de profil change les réglages effectifs.
    profiles.onChange(() => this.#refresh());
  }

  get(): BotConfig {
    return this.#config;
  }

  update(config: BotConfig): void {
    const shared = Object.fromEntries(
      Object.entries(config).filter(
        ([key]) => !(PROFILE_FIELDS as readonly string[]).includes(key),
      ),
    );
    this.db
      .insert(botSettings)
      .values({ id: BOT_SETTINGS_ID, config: shared })
      .onConflictDoUpdate({
        target: botSettings.id,
        set: { config: shared, updatedAt: new Date() },
      })
      .run();
    this.#shared = shared;
    this.logBus.push('system', `Réglages enregistrés (profil « ${this.profiles.activeName()} »).`);
    // Notifie aussi, via `onChange` des profils, le recalcul de `#config`.
    this.profiles.saveBehavior(config as ProfileBehavior);
  }

  /** Renvoie la fonction de désabonnement. */
  onChange(listener: (previous: BotConfig, next: BotConfig) => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #refresh(): void {
    const previous = this.#config;
    this.#config = this.#compute();
    for (const listener of this.#listeners) listener(previous, this.#config);
  }

  #compute(): BotConfig {
    // Les réglages ajoutés par une version plus récente prennent leur valeur par défaut.
    const merged = { ...DEFAULT_BOT_CONFIG, ...this.#shared, ...this.profiles.behavior() };
    const parsed = botConfigSchema.safeParse(merged);
    if (parsed.success) return parsed.data;
    this.logBus.push('error', 'Réglages du bot illisibles : valeurs par défaut utilisées.');
    return DEFAULT_BOT_CONFIG;
  }
}
