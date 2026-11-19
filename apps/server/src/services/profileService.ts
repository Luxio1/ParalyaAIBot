import { PROFILE_FIELDS, type ProfileBehavior, type ProfilesState } from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { BOT_SETTINGS_ID, botSettings, profiles } from '../db/schema';
import { AppError } from '../lib/appError';

interface Profile {
  id: number;
  name: string;
  /** Réglages `PROFILE_FIELDS` enregistrés ; ceux qui manquent prennent la valeur par défaut. */
  behavior: Partial<ProfileBehavior>;
  commandIds: Set<number>;
  eventRuleIds: Set<number>;
}

/**
 * Profils de comportement : un seul actif pour tout le bot. Le profil porte le persona, le modèle,
 * le déclenchement, les salons, la mémoire, et les commandes et règles actives.
 */
export class ProfileService {
  #profiles: Profile[] = [];
  #activeId = 0;
  readonly #listeners = new Set<() => void>();

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
  ) {
    this.#reload();
    if (this.#profiles.length === 0) {
      db.insert(profiles).values({ name: 'Normal' }).run();
      this.#reload();
    }
  }

  state(): ProfilesState {
    return {
      activeId: this.#activeId,
      profiles: this.#profiles.map(({ id, name }) => ({ id, name })),
    };
  }

  activeName(): string {
    return this.#active().name;
  }

  behavior(): Partial<ProfileBehavior> {
    return this.#active().behavior;
  }

  saveBehavior(behavior: ProfileBehavior): void {
    this.#write(this.#activeId, { behavior: pick(behavior) });
  }

  /** Nouveau profil, copie du profil actif (réglages, commandes et règles actives). */
  create(name: string): void {
    this.#assertNameFree(name);
    const source = this.#active();
    this.db
      .insert(profiles)
      .values({
        name,
        behavior: source.behavior,
        commandIds: [...source.commandIds],
        eventRuleIds: [...source.eventRuleIds],
      })
      .run();
    this.#changed(`Profil « ${name} » créé.`);
  }

  rename(id: number, name: string): void {
    const profile = this.#get(id);
    this.#assertNameFree(name, id);
    this.db.update(profiles).set({ name, updatedAt: new Date() }).where(eq(profiles.id, id)).run();
    this.#changed(`Profil « ${profile.name} » renommé en « ${name} ».`);
  }

  remove(id: number): void {
    const profile = this.#get(id);
    if (id === this.#activeId) {
      throw new AppError(
        400,
        'profile_active',
        'Activez un autre profil avant de supprimer celui-ci.',
      );
    }
    this.db.delete(profiles).where(eq(profiles.id, id)).run();
    this.#changed(`Profil « ${profile.name} » supprimé.`);
  }

  activate(id: number): void {
    const profile = this.#get(id);
    if (id === this.#activeId) return;
    this.db
      .insert(botSettings)
      .values({ id: BOT_SETTINGS_ID, activeProfileId: id })
      .onConflictDoUpdate({ target: botSettings.id, set: { activeProfileId: id } })
      .run();
    this.#changed(`Profil « ${profile.name} » activé.`);
  }

  isCommandEnabled(id: number): boolean {
    return this.#active().commandIds.has(id);
  }

  isRuleEnabled(id: number): boolean {
    return this.#active().eventRuleIds.has(id);
  }

  /** Active ou désactive une commande dans le profil actif. */
  setCommandEnabled(id: number, enabled: boolean): void {
    const ids = toggle(this.#active().commandIds, id, enabled);
    if (ids) this.#write(this.#activeId, { commandIds: ids });
  }

  setRuleEnabled(id: number, enabled: boolean): void {
    const ids = toggle(this.#active().eventRuleIds, id, enabled);
    if (ids) this.#write(this.#activeId, { eventRuleIds: ids });
  }

  /** Retire une commande supprimée de tous les profils. */
  forgetCommand(id: number): void {
    for (const profile of this.#profiles) {
      const ids = toggle(profile.commandIds, id, false);
      if (ids) this.#write(profile.id, { commandIds: ids });
    }
  }

  forgetRule(id: number): void {
    for (const profile of this.#profiles) {
      const ids = toggle(profile.eventRuleIds, id, false);
      if (ids) this.#write(profile.id, { eventRuleIds: ids });
    }
  }

  /** Changement de profil actif, de liste ou de contenu ; renvoie la fonction de désabonnement. */
  onChange(listener: () => void): () => void {
    this.#listeners.add(listener);
    return () => this.#listeners.delete(listener);
  }

  #write(
    id: number,
    values: Partial<{ behavior: object; commandIds: number[]; eventRuleIds: number[] }>,
  ): void {
    this.db
      .update(profiles)
      .set({ ...values, updatedAt: new Date() })
      .where(eq(profiles.id, id))
      .run();
    this.#reload();
    this.#emit();
  }

  #changed(message: string): void {
    this.#reload();
    this.logBus.push('system', message);
    this.#emit();
  }

  #emit(): void {
    for (const listener of this.#listeners) listener();
  }

  #reload(): void {
    this.#profiles = this.db
      .select()
      .from(profiles)
      .orderBy(profiles.id)
      .all()
      .map((row) => ({
        id: row.id,
        name: row.name,
        behavior: pick(row.behavior as Partial<ProfileBehavior>),
        commandIds: new Set(row.commandIds),
        eventRuleIds: new Set(row.eventRuleIds),
      }));
    const settings = this.db
      .select()
      .from(botSettings)
      .where(eq(botSettings.id, BOT_SETTINGS_ID))
      .get();
    const stored = this.#profiles.find((profile) => profile.id === settings?.activeProfileId);
    this.#activeId = (stored ?? this.#profiles[0])?.id ?? 0;
  }

  #active(): Profile {
    return this.#get(this.#activeId);
  }

  #get(id: number): Profile {
    const profile = this.#profiles.find((candidate) => candidate.id === id);
    if (!profile) throw new AppError(404, 'not_found', 'Profil introuvable.');
    return profile;
  }

  #assertNameFree(name: string, exceptId?: number): void {
    const taken = this.#profiles.some(
      (profile) => profile.id !== exceptId && profile.name.toLowerCase() === name.toLowerCase(),
    );
    if (taken) throw new AppError(409, 'profile_exists', `Un profil « ${name} » existe déjà.`);
  }
}

/** Ne garde que les réglages propres aux profils. */
function pick(values: Partial<ProfileBehavior>): Partial<ProfileBehavior> {
  return Object.fromEntries(
    PROFILE_FIELDS.filter((field) => values[field] !== undefined).map((field) => [
      field,
      values[field],
    ]),
  );
}

/** Nouvelle liste, ou `null` si rien ne change. */
function toggle(ids: Set<number>, id: number, enabled: boolean): number[] | null {
  if (ids.has(id) === enabled) return null;
  const next = new Set(ids);
  if (enabled) next.add(id);
  else next.delete(id);
  return [...next];
}
