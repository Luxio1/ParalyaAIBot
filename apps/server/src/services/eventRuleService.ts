import {
  EXAMPLE_EVENT_RULES,
  MAX_EVENT_RULES,
  eventRuleSchema,
  type EventRule,
  type EventRuleInput,
} from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { Db } from '../db/client';
import { BOT_SETTINGS_ID, botSettings, eventRules } from '../db/schema';
import { AppError } from '../lib/appError';
import type { ProfileService } from './profileService';

/**
 * Règles du moteur d'événements, gardées en mémoire : une modification s'applique au message
 * suivant. `enabled` désigne l'état dans le profil actif.
 */
export class EventRuleService {
  #rules: EventRule[] = [];

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
    private readonly profiles: ProfileService,
  ) {
    this.#seedExamplesOnce();
    this.#reload();
  }

  list(): EventRule[] {
    return this.#rules.map((rule) => ({ ...rule, enabled: this.profiles.isRuleEnabled(rule.id) }));
  }

  enabled(): EventRule[] {
    return this.list().filter((rule) => rule.enabled);
  }

  create(input: EventRuleInput): void {
    if (this.#rules.length >= MAX_EVENT_RULES) {
      throw new AppError(400, 'too_many_rules', `${MAX_EVENT_RULES} règles au maximum.`);
    }
    const { enabled, ...definition } = input;
    const { id } = this.db
      .insert(eventRules)
      .values({ definition })
      .returning({ id: eventRules.id })
      .get();
    this.profiles.setRuleEnabled(id, enabled);
    this.#changed(`Règle « ${input.name} » créée.`);
  }

  update(id: number, input: EventRuleInput): void {
    this.#get(id);
    const { enabled, ...definition } = input;
    this.db
      .update(eventRules)
      .set({ definition, updatedAt: new Date() })
      .where(eq(eventRules.id, id))
      .run();
    this.profiles.setRuleEnabled(id, enabled);
    this.#changed(`Règle « ${input.name} » modifiée.`);
  }

  remove(id: number): void {
    const rule = this.#get(id);
    this.db.delete(eventRules).where(eq(eventRules.id, id)).run();
    this.profiles.forgetRule(id);
    this.#changed(`Règle « ${rule.name} » supprimée.`);
  }

  /** La copie est désactivée, pour ne pas déclencher deux fois avant d'avoir été modifiée. */
  duplicate(id: number): void {
    const { id: _id, ...source } = this.#get(id);
    this.create({ ...source, name: `${source.name} (copie)`.slice(0, 100), enabled: false });
  }

  /** Recrée les exemples, désactivés ; ceux qui portent le même nom sont remplacés. */
  restoreExamples(): void {
    const names = new Set(EXAMPLE_EVENT_RULES.map((rule) => rule.name));
    this.db.transaction((tx) => {
      for (const rule of this.#rules.filter((candidate) => names.has(candidate.name))) {
        tx.delete(eventRules).where(eq(eventRules.id, rule.id)).run();
      }
      tx.insert(eventRules).values(exampleRows()).run();
    });
    for (const rule of this.#rules.filter((candidate) => names.has(candidate.name))) {
      this.profiles.forgetRule(rule.id);
    }
    this.#changed("Règles d'exemple restaurées (désactivées).");
  }

  #seedExamplesOnce(): void {
    const settings = this.db
      .select()
      .from(botSettings)
      .where(eq(botSettings.id, BOT_SETTINGS_ID))
      .get();
    if (settings?.eventsSeeded) return;
    this.db.transaction((tx) => {
      tx.insert(eventRules).values(exampleRows()).run();
      tx.insert(botSettings)
        .values({ id: BOT_SETTINGS_ID, eventsSeeded: true })
        .onConflictDoUpdate({ target: botSettings.id, set: { eventsSeeded: true } })
        .run();
    });
  }

  #reload(): void {
    const rows = this.db.select().from(eventRules).orderBy(eventRules.id).all();
    this.#rules = rows.flatMap((row) => {
      // `enabled` est fourni par le profil actif dans `list()`.
      const definition = { ...(row.definition as object), enabled: false, id: row.id };
      const parsed = eventRuleSchema.safeParse(definition);
      if (parsed.success) return [parsed.data];
      this.logBus.push('error', `Règle d'événement n° ${row.id} illisible : ignorée.`);
      return [];
    });
  }

  #changed(message: string): void {
    this.#reload();
    this.logBus.push('system', message);
  }

  #get(id: number): EventRule {
    const rule = this.#rules.find((candidate) => candidate.id === id);
    if (!rule) throw new AppError(404, 'not_found', 'Règle introuvable.');
    return rule;
  }
}

/** Exemples installés désactivés : ils n'entrent dans aucun profil. */
function exampleRows() {
  return EXAMPLE_EVENT_RULES.map(({ enabled: _enabled, ...definition }) => ({ definition }));
}
