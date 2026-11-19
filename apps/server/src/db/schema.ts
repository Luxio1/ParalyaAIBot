import { COMMAND_TYPES, SECRET_NAMES } from '@bot/shared';
import { sql } from 'drizzle-orm';
import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

const timestamp = (name: string) =>
  integer(name, { mode: 'timestamp_ms' })
    .notNull()
    .default(sql`(unixepoch() * 1000)`);

export const users = sqliteTable('users', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  username: text('username').notNull().unique(),
  /** Hash argon2id, jamais le mot de passe en clair. */
  passwordHash: text('password_hash').notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const sessions = sqliteTable(
  'sessions',
  {
    /** SHA-256 du jeton du cookie : une fuite de la base ne donne pas de session utilisable. */
    id: text('id').primaryKey(),
    userId: integer('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    expiresAt: integer('expires_at', { mode: 'timestamp_ms' }).notNull(),
    createdAt: timestamp('created_at'),
  },
  (table) => [index('sessions_user_id_idx').on(table.userId)],
);

export const secrets = sqliteTable('secrets', {
  name: text('name', { enum: SECRET_NAMES }).primaryKey(),
  /** Format de `lib/crypto.ts`, chiffré avec le nom du secret comme donnée authentifiée. */
  ciphertext: text('ciphertext').notNull(),
  updatedAt: timestamp('updated_at'),
});

/** Identifiant de l'unique ligne de `bot_settings`. */
export const BOT_SETTINGS_ID = 1;

export const botSettings = sqliteTable('bot_settings', {
  id: integer('id').primaryKey(),
  /** Vrai tant que le bot doit tourner : il se reconnecte alors au démarrage du serveur. */
  autoStart: integer('auto_start', { mode: 'boolean' }).notNull().default(false),
  /** `BotConfig` en JSON, validé et complété par les valeurs par défaut à la lecture. */
  config: text('config', { mode: 'json' }).notNull().default({}),
  /** Exemples installés une seule fois : supprimés, ils ne reviennent pas au redémarrage. */
  commandsSeeded: integer('commands_seeded', { mode: 'boolean' }).notNull().default(false),
  eventsSeeded: integer('events_seeded', { mode: 'boolean' }).notNull().default(false),
  /** Profil de comportement en cours ; à défaut, le premier profil. */
  activeProfileId: integer('active_profile_id'),
  updatedAt: timestamp('updated_at'),
});

/**
 * Profils de comportement : réglages `PROFILE_FIELDS` (JSON, complétés à la lecture), et
 * commandes et règles d'événements actives dans ce profil.
 */
export const profiles = sqliteTable('profiles', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull().unique(),
  behavior: text('behavior', { mode: 'json' }).notNull().default({}),
  commandIds: text('command_ids', { mode: 'json' }).$type<number[]>().notNull().default([]),
  eventRuleIds: text('event_rule_ids', { mode: 'json' }).$type<number[]>().notNull().default([]),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

export const commands = sqliteTable('commands', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  /** En minuscules, sans le préfixe. */
  name: text('name').notNull().unique(),
  description: text('description').notNull().default(''),
  type: text('type', { enum: COMMAND_TYPES }).notNull(),
  response: text('response').notNull().default(''),
  promptTemplate: text('prompt_template').notNull().default(''),
  systemPrompt: text('system_prompt').notNull().default(''),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});

/**
 * Règles du moteur d'événements ; `definition` est un `EventRuleInput` sans `enabled` (qui dépend
 * du profil actif), en JSON validé à la lecture.
 */
export const eventRules = sqliteTable('event_rules', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  definition: text('definition', { mode: 'json' }).notNull(),
  createdAt: timestamp('created_at'),
  updatedAt: timestamp('updated_at'),
});
