import { EXAMPLE_COMMANDS, MAX_COMMANDS, type Command, type CommandInput } from '@bot/shared';
import { eq } from 'drizzle-orm';
import type { LogBus } from '../core/logs/logBus';
import type { CommandCatalog } from '../core/pipeline/commands';
import type { Db } from '../db/client';
import { BOT_SETTINGS_ID, botSettings, commands } from '../db/schema';
import { AppError } from '../lib/appError';

const NAME_MAX_LENGTH = 32;

/** Commandes personnalisées, gardées en mémoire : une modification s'applique au message suivant. */
export class CommandService implements CommandCatalog {
  #byName = new Map<string, Command>();

  constructor(
    private readonly db: Db,
    private readonly logBus: LogBus,
  ) {
    this.#seedExamplesOnce();
    this.#reload();
  }

  list(): Command[] {
    return [...this.#byName.values()].sort((a, b) => a.name.localeCompare(b.name, 'fr'));
  }

  find(name: string): Command | undefined {
    const command = this.#byName.get(name.toLowerCase());
    return command?.enabled ? command : undefined;
  }

  enabled(): Command[] {
    return this.list().filter((command) => command.enabled);
  }

  create(input: CommandInput): void {
    if (this.#byName.size >= MAX_COMMANDS) {
      throw new AppError(400, 'too_many_commands', `${MAX_COMMANDS} commandes au maximum.`);
    }
    this.#assertNameFree(input.name);
    this.db.insert(commands).values(input).run();
    this.#changed(`Commande « ${input.name} » créée.`);
  }

  update(id: number, input: CommandInput): void {
    const current = this.#get(id);
    this.#assertNameFree(input.name, id);
    this.db
      .update(commands)
      .set({ ...input, updatedAt: new Date() })
      .where(eq(commands.id, id))
      .run();
    this.#changed(`Commande « ${current.name} » modifiée.`);
  }

  remove(id: number): void {
    const current = this.#get(id);
    this.db.delete(commands).where(eq(commands.id, id)).run();
    this.#changed(`Commande « ${current.name} » supprimée.`);
  }

  /** La copie est désactivée, pour ne pas répondre deux fois avant d'avoir été modifiée. */
  duplicate(id: number): void {
    const { id: _id, ...source } = this.#get(id);
    this.create({ ...source, name: this.#copyName(source.name), enabled: false });
  }

  /** Recrée les exemples supprimés et remet à zéro ceux qui ont été modifiés. */
  restoreExamples(): void {
    this.db.transaction((tx) => {
      for (const example of EXAMPLE_COMMANDS) {
        tx.insert(commands)
          .values(example)
          .onConflictDoUpdate({
            target: commands.name,
            set: { ...example, updatedAt: new Date() },
          })
          .run();
      }
    });
    this.#changed("Commandes d'exemple restaurées.");
  }

  #seedExamplesOnce(): void {
    const settings = this.db
      .select()
      .from(botSettings)
      .where(eq(botSettings.id, BOT_SETTINGS_ID))
      .get();
    if (settings?.commandsSeeded) return;
    this.db.transaction((tx) => {
      tx.insert(commands).values(EXAMPLE_COMMANDS).onConflictDoNothing().run();
      tx.insert(botSettings)
        .values({ id: BOT_SETTINGS_ID, commandsSeeded: true })
        .onConflictDoUpdate({ target: botSettings.id, set: { commandsSeeded: true } })
        .run();
    });
  }

  #reload(): void {
    const rows = this.db.select().from(commands).all();
    this.#byName = new Map(
      rows.map(({ createdAt: _created, updatedAt: _updated, ...command }) => [
        command.name,
        command,
      ]),
    );
  }

  #changed(message: string): void {
    this.#reload();
    this.logBus.push('system', message);
  }

  #get(id: number): Command {
    const command = [...this.#byName.values()].find((candidate) => candidate.id === id);
    if (!command) throw new AppError(404, 'not_found', 'Commande introuvable.');
    return command;
  }

  #assertNameFree(name: string, exceptId?: number): void {
    const existing = this.#byName.get(name);
    if (existing && existing.id !== exceptId) {
      throw new AppError(409, 'command_exists', `Une commande « ${name} » existe déjà.`);
    }
  }

  /** `nom-copie`, puis `nom-copie-2`, etc., dans la limite de 32 caractères. */
  #copyName(name: string): string {
    for (let index = 1; ; index++) {
      const suffix = index === 1 ? '-copie' : `-copie-${index}`;
      const candidate = name.slice(0, NAME_MAX_LENGTH - suffix.length) + suffix;
      if (!this.#byName.has(candidate)) return candidate;
    }
  }
}
