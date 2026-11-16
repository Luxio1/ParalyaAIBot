import { healthResponseSchema } from '@bot/shared';
import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { openDatabase, type DatabaseHandle } from '../db/client';
import { runMigrations } from '../db/migrate';
import { users } from '../db/schema';
import { parseEnv } from '../env';
import { buildApp } from './app';

const env = parseEnv({
  NODE_ENV: 'test',
  APP_SECRET: 'x'.repeat(48),
  WEB_DIST_DIR: '/dossier/inexistant',
});

describe('application HTTP', () => {
  let database: DatabaseHandle;
  let app: FastifyInstance;

  beforeEach(async () => {
    database = openDatabase(':memory:');
    runMigrations(database.db);
    app = await buildApp({ env, database });
  });

  afterEach(async () => {
    await app.close();
    database.close();
  });

  it('GET /healthz répond ok avec un corps conforme au schéma partagé', async () => {
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(200);
    const body = healthResponseSchema.parse(response.json());
    expect(body.database).toBe('ok');
  });

  it('GET /healthz répond 503 si la base est fermée', async () => {
    database.close();
    const response = await app.inject({ method: 'GET', url: '/healthz' });
    expect(response.statusCode).toBe(503);
    expect(response.json().database).toBe('error');
  });

  it('renvoie un 404 JSON pour une route inconnue', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/inconnue' });
    expect(response.statusCode).toBe(404);
    expect(response.json().error).toBe('not_found');
  });

  it('refuse un corps de requête trop volumineux', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/inconnue',
      headers: { 'content-type': 'application/json' },
      payload: JSON.stringify({ data: 'a'.repeat(2 * 1024 * 1024) }),
    });
    expect(response.statusCode).toBe(413);
  });

  it('les migrations créent la table users', () => {
    database.db.insert(users).values({ username: 'admin', passwordHash: 'hash' }).run();
    const rows = database.db.select().from(users).all();
    expect(rows).toHaveLength(1);
    expect(rows[0]?.createdAt).toBeInstanceOf(Date);
  });
});
