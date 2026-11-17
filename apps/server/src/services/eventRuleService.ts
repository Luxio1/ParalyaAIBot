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

/** Règles du moteur d'événements, gardées en mémoire : une modification s'applique au message suivant. */
export class EventRuleService {
  #rules: EventRule[] = [];

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
  ) {
    this.#seedExamplesOnce();
    this.#reload();
  }

  list(): EventRule[] {
    return this.#rules;
  }

  enabled(): EventRule[] {
    return this.#rules.filter((rule) => rule.enabled);
  }

  create(input: EventRuleInput): void {
    if (this.#rules.length >= MAX_EVENT_RULES) {
      throw new AppError(400, 'too_many_rules', `${MAX_EVENT_RULES} règles au maximum.`);
    }
    this.db.insert(eventRules).values({ definition: input }).run();
    this.#changed(`Règle « ${input.name} » créée.`);
  }

  update(id: number, input: EventRuleInput): void {
    this.#get(id);
    this.db
      .update(eventRules)
      .set({ definition: input, updatedAt: new Date() })
      .where(eq(eventRules.id, id))
      .run();
    this.#changed(`Règle « ${input.name} » modifiée.`);
  }

  remove(id: number): void {
    const rule = this.#get(id);
    this.db.delete(eventRules).where(eq(eventRules.id, id)).run();
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
      tx.insert(eventRules)
        .values(EXAMPLE_EVENT_RULES.map((definition) => ({ definition })))
        .run();
    });
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
      tx.insert(eventRules)
        .values(EXAMPLE_EVENT_RULES.map((definition) => ({ definition })))
        .run();
      tx.insert(botSettings)
        .values({ id: BOT_SETTINGS_ID, eventsSeeded: true })
        .onConflictDoUpdate({ target: botSettings.id, set: { eventsSeeded: true } })
        .run();
    });
  }

  #reload(): void {
    const rows = this.db.select().from(eventRules).orderBy(eventRules.id).all();
    this.#rules = rows.flatMap((row) => {
      const parsed = eventRuleSchema.safeParse({ ...(row.definition as object), id: row.id });
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
