/** Shared, server-only transport. Never logs URLs, keys, response bodies, or raw network errors. */
export const PROVIDER_TIMEOUT_MS = 8000;
export const PROVIDER_ATTEMPTS = 2;
const CACHE_MS = 60_000;
const requests = new Map<string, { at: number; pending: boolean; promise: Promise<unknown> }>();

export function providerHttpError(provider: string, status: number) {
  if (status === 401 || status === 403) return `${provider}: API key invalid, expired, or not authorized (HTTP ${status}).`;
  if (status === 429) return `${provider}: request quota exceeded (HTTP 429). Try again later or check your API plan.`;
  if (status >= 500) return `${provider}: service temporarily unavailable (HTTP ${status}).`;
  return `${provider}: request rejected (HTTP ${status}).`;
}

export async function requestProviderJson<T>(url: string, provider: string): Promise<T> {
  const hit = requests.get(url);
  if (hit && (hit.pending || Date.now() - hit.at < CACHE_MS)) return hit.promise as Promise<T>;
  const entry = { at: 0, pending: true, promise: Promise.resolve(null) as Promise<unknown> };
  entry.promise = (async () => {
    for (let attempt = 0; attempt < PROVIDER_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
      let retry = true;
      let error = `${provider}: network connection failed.`;
      try {
        const response = await fetch(url, { signal: controller.signal });
        if (response.ok) {
          try {
            const json: unknown = await response.json();
            if (!json || typeof json !== 'object' || Array.isArray(json)) throw new Error();
            return json;
          } catch {
            error = `${provider}: malformed response.`;
            retry = false;
          }
        } else {
          error = providerHttpError(provider, response.status);
          retry = response.status >= 500; // quotas/auth errors need account action, not immediate bursts
        }
      } catch {
        error = controller.signal.aborted ? `${provider}: request timed out.` : `${provider}: network connection failed.`;
      } finally {
        clearTimeout(timer);
      }
      if (!retry || attempt === PROVIDER_ATTEMPTS - 1) {
        console.warn('[UrbanEcoSense:provider]', JSON.stringify({ provider, attempt: attempt + 1, error }));
        throw new Error(error);
      }
      await new Promise(resolve => setTimeout(resolve, 300));
    }
    throw new Error(`${provider}: request failed.`);
  })().then(value => { entry.pending = false; entry.at = Date.now(); return value; }).catch(error => {
    if (requests.get(url) === entry) requests.delete(url);
    throw error;
  });
  requests.set(url, entry);
  return entry.promise as Promise<T>;
}

export function finiteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

export async function requestWeatherJson<T>(url: string, provider: string): Promise<T> {
  const value = await requestProviderJson<Record<string, unknown>>(url, provider);
  const valid = url.includes('/air_pollution')
    ? Array.isArray(value.list) && value.list.length > 0 && typeof value.list[0]?.components === 'object' && value.list[0]?.components !== null
    : typeof value.main === 'object' && value.main !== null && finiteNumber((value.main as Record<string, unknown>).temp) !== null;
  if (!valid) {
    requests.delete(url);
    throw new Error(`${provider}: malformed or empty response.`);
  }
  return value as T;
}