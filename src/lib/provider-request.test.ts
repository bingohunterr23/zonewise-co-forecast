import { afterEach, describe, expect, it, vi } from 'vitest';

afterEach(() => { vi.unstubAllGlobals(); vi.resetModules(); vi.useRealTimers(); });
describe('safe provider transport', () => {
  it('deduplicates simultaneous successful requests', async () => {
    const fetcher = vi.fn(async () => Response.json({ main: { temp: 24 } }));
    vi.stubGlobal('fetch', fetcher);
    const { requestWeatherJson } = await import('./provider-request.server');
    const results = await Promise.all([requestWeatherJson('https://weather.test/weather', 'weather'), requestWeatherJson('https://weather.test/weather', 'weather')]);
    expect(results[0]).toEqual({ main: { temp: 24 } });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([401, 403, 429])('fails HTTP %s without retries or leaking response secrets', async status => {
    const fetcher = vi.fn(async () => new Response('private-key', { status }));
    vi.stubGlobal('fetch', fetcher);
    const { requestProviderJson } = await import('./provider-request.server');
    await expect(requestProviderJson('https://weather.test?key=private-key', 'weather')).rejects.toThrow(`HTTP ${status}`);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retries a temporary outage only once', async () => {
    const fetcher = vi.fn().mockResolvedValueOnce(new Response('', { status: 503 })).mockResolvedValueOnce(Response.json({ ok: true }));
    vi.stubGlobal('fetch', fetcher);
    const { requestProviderJson } = await import('./provider-request.server');
    await expect(requestProviderJson('https://test', 'weather')).resolves.toEqual({ ok: true });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('sanitizes network failures and retries within the bound', async () => {
    const fetcher = vi.fn().mockRejectedValue(new Error('URL includes secret-key'));
    vi.stubGlobal('fetch', fetcher);
    const { requestProviderJson } = await import('./provider-request.server');
    await expect(requestProviderJson('https://test', 'weather')).rejects.toThrow('weather: network connection failed.');
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('times out hung requests and retries once', async () => {
    vi.useFakeTimers();
    vi.stubGlobal('fetch', vi.fn((_url, options) => new Promise((_resolve, reject) => options.signal.addEventListener('abort', () => reject(new Error('aborted'))))));
    const { requestProviderJson } = await import('./provider-request.server');
    const assertion = expect(requestProviderJson('https://test', 'weather')).rejects.toThrow('request timed out');
    await vi.runAllTimersAsync();
    await assertion;
    expect(fetch).toHaveBeenCalledTimes(2);
  });
  it.each([{}, { list: [] }, { list: [{ components: null }] }])('rejects empty air responses', async body => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json(body)));
    const { requestWeatherJson } = await import('./provider-request.server');
    await expect(requestWeatherJson('https://test/air_pollution', 'air')).rejects.toThrow('malformed or empty');
  });
  it('weather still succeeds if air quality fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async url => String(url).includes('air_pollution') ? new Response('', { status: 401 }) : Response.json({ main: { temp: 23 } })));
    const { requestWeatherJson } = await import('./provider-request.server');
    const [weather, air] = await Promise.allSettled([requestWeatherJson('https://test/weather', 'weather'), requestWeatherJson('https://test/air_pollution', 'air')]);
    expect(weather.status).toBe('fulfilled');
    expect(air.status).toBe('rejected');
  });
});