import {
  apiErrorSchema,
  authStateSchema,
  botConfigSchema,
  commandSchema,
  discoveredGuildSchema,
  eventRuleSchema,
  memorySessionSchema,
} from '@bot/shared';
import { queryOptions } from '@tanstack/react-query';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

interface Schema<T> {
  parse(data: unknown): T;
}

export async function apiGet<T>(path: string, schema: Schema<T>): Promise<T> {
  const response = await request('GET', path);
  return schema.parse(await response.json());
}

/** Action qui renvoie un résultat (le testeur d'événements). */
export async function apiPost<T>(path: string, body: unknown, schema: Schema<T>): Promise<T> {
  const response = await request('POST', path, body);
  return schema.parse(await response.json());
}

/** Les mutations de l'API répondent 204 sans corps. */
export async function apiSend(
  method: 'POST' | 'PUT' | 'DELETE',
  path: string,
  body?: unknown,
): Promise<void> {
  await request(method, path, body);
}

export const authStateQuery = queryOptions({
  queryKey: ['auth'],
  queryFn: () => apiGet('/api/auth/state', authStateSchema),
});

export const BOT_DISCOVERY_QUERY_KEY = ['bot', 'discovery'];

export const configQuery = queryOptions({
  queryKey: ['config'],
  queryFn: () => apiGet('/api/config', botConfigSchema),
});

export const commandsQuery = queryOptions({
  queryKey: ['commands'],
  queryFn: () => apiGet('/api/commands', commandSchema.array()),
});

export const eventRulesQuery = queryOptions({
  queryKey: ['events', 'rules'],
  queryFn: () => apiGet('/api/events/rules', eventRuleSchema.array()),
});

export const memorySessionsQuery = queryOptions({
  queryKey: ['memory', 'sessions'],
  queryFn: () => apiGet('/api/memory/sessions', memorySessionSchema.array()),
});

export const botDiscoveryQuery = queryOptions({
  queryKey: BOT_DISCOVERY_QUERY_KEY,
  queryFn: () => apiGet('/api/bot/discovery', discoveredGuildSchema.array()),
});

async function request(method: string, path: string, body?: unknown): Promise<Response> {
  const response = await fetch(path, {
    method,
    headers: body === undefined ? {} : { 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (response.ok) return response;

  // Un proxy ou un serveur arrêté peut répondre autre chose que du JSON.
  const parsed = apiErrorSchema.safeParse(await response.json().catch(() => null));
  throw parsed.success
    ? new ApiError(response.status, parsed.data.error, parsed.data.message)
    : new ApiError(response.status, 'http_error', `Le serveur a répondu ${response.status}.`);
}
