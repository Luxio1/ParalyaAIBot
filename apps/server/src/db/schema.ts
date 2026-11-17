import { SECRET_NAMES } from '@bot/shared';
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

/** Une seule ligne (`id = 1`). */
export const botSettings = sqliteTable('bot_settings', {
  id: integer('id').primaryKey(),
  /** Vrai tant que le bot doit tourner : il se reconnecte alors au démarrage du serveur. */
  autoStart: integer('auto_start', { mode: 'boolean' }).notNull().default(false),
  updatedAt: timestamp('updated_at'),
});
