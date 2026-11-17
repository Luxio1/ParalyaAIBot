import { apiErrorSchema, authStateSchema } from '@bot/shared';
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

/** Toutes les mutations de l'API répondent 204 sans corps. */
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
