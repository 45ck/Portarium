import { CockpitApiError } from '@/lib/control-plane-client';

export async function fetchJson<T>(
  input: RequestInfo | URL,
  init?: RequestInit,
  fallbackMessage = 'Request failed',
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    let rawBody: string | undefined;
    try {
      rawBody = await response.text();
    } catch {
      rawBody = undefined;
    }
    throw new CockpitApiError(response.status, rawBody || fallbackMessage, { rawBody });
  }
  return response.json() as Promise<T>;
}
