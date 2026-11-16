import { healthResponseSchema, type HealthResponse } from '@bot/shared';

export async function fetchHealth(signal?: AbortSignal): Promise<HealthResponse> {
  const response = await fetch('/healthz', { signal });
  // 503 = serveur joignable mais base en erreur : le corps reste exploitable.
  if (!response.ok && response.status !== 503) {
    throw new Error(`Le serveur a répondu ${response.status}`);
  }
  return healthResponseSchema.parse(await response.json());
}
