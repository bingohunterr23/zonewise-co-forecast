# UrbanEcoSense API reliability report

## Findings and root causes

Both configured keys work in the current preview: the signed-in CO₂ page returned live traffic, weather, air quality and estimates for all eight zones. No current account-authentication failure was reproduced. Earlier diagnostics recorded a preview process that had not loaded newly saved keys; that historical startup issue is distinct from the refresh defects fixed here.

The actual refresh defects in the existing code were:
- Overview and live cards deliberately replaced values with null while loading, making Refresh look like data loss.
- Successful HTTP responses containing per-zone errors replaced whole readings, even when previous measurements were valid.
- Live-monitoring errors were hidden when old rows existed; provider-specific errors were absent from the frontend reading type.
- Page requests could overlap; traffic refresh failures erased previous traffic; page reload discarded in-memory environmental readings.
- CO₂ and traffic requests lacked timeouts/retries; the separate monitoring helper could log raw response bodies and network messages.
- Invalid/empty payloads were accepted without sufficient validation.
- The unintended CHETNA descriptions were literal strings in HomePage and AuthPage, not provider or model names.

## Implementation

Provider calls remain server-only. OpenWeather uses `/data/2.5/weather` with latitude, longitude, metric units and `appid`, and `/data/2.5/air_pollution` with coordinates and `appid`. TomTom uses `/traffic/services/4/flowSegmentData/absolute/10/json` with point, KMPH and `key`. Keys are trimmed and read at request time.

Each request has an 8-second timeout and at most two attempts. Only network/timeout/5xx failures retry, with 300 ms backoff. Authentication and quota errors fail promptly with actionable messages, avoiding quota retry bursts. Logs never contain request URLs, key values, raw response bodies or raw network errors. Weather, air quality and traffic remain independent.

Identical in-flight requests share one promise. Successful raw provider responses are reused for 60 seconds; traffic retains its existing 2-minute zone cache, measured from successful completion. These are bounded caches of real readings, not prediction substitutes. Predictions continue to be calculated from actual model inputs; no fake readings or default predictions were added.

Shared browser state preserves successful per-zone measurements and their original timestamp. Environmental readings survive a reload in same-tab session storage and are explicitly stale until a successful refresh. Partial cards conservatively carry the oldest retained timestamp. Traffic failures retain real previous speeds marked stale. CO₂ refresh transport/partial-provider failures can retain the previous same-zone result explicitly marked stale; switching zones never borrows another zone's result. Missing first-load data remains unavailable with errors, never zero-filled. Region AQI now shows a dash when no real AQI exists.

## Changed files

| File | Change |
| --- | --- |
| `src/lib/provider-request.server.ts` | New shared transport, timeout, bounded retries, dedup/cache, payload validation, safe errors. |
| `src/lib/provider-request.test.ts` | Success, dedup, auth, quota, outage, network, timeout, malformed responses, partial availability tests. |
| `src/lib/ues.functions.ts` | Uses shared safe OpenWeather transport and trimmed key; removes unsafe transport logging and touched concurrency assertion. |
| `src/lib/co2.functions.ts` | Uses shared OpenWeather transport; trims keys; safe input-vector access. |
| `src/lib/traffic/live-traffic.server.ts` | Shared transport, validated flow, stale type, in-flight dedup, cache timestamp at completion. |
| `src/lib/traffic/live-traffic.test.ts` | Coordinate/units and malformed-flow tests; updated quota error assertion. |
| `src/lib/reading-state.ts` | Per-zone last-success merging, stale detection, null-safe AQI averaging. |
| `src/lib/reading-state.test.ts` | Timestamp retention, stale expiry, no cross-zone borrowing, no misleading missing AQI zero. |
| `src/hooks/useLiveReadings.ts` | Shared environmental lifecycle, overlap prevention, optional same-tab last-success storage and timed refresh. |
| `src/hooks/useLiveTraffic.ts` | In-flight dedup, last-success retention and explicit staleness. |
| `src/components/LiveTrafficBadge.tsx` | Visible safe provider failures and stale timestamps during refresh. |
| `src/types/index.ts` | Reading errors and stale flag exposed to pages. |
| `src/pages/HomePage.tsx` | Shared readings, preserved refresh metrics, corrected subtitle, valid region averages. |
| `src/pages/LiveMonitoringPage.tsx` | Shared readings, visible errors, stale timestamps, independent traffic refresh. |
| `src/pages/AreaVisualizationPage.tsx` | Shared readings, refresh/time status, visible popup and zone errors; avoids destroying populated map during refresh. |
| `src/pages/PredictionPage.tsx` | Same-zone in-flight reuse, zone-switch guard, stale retention, metadata failures no longer hide live results. |
| `src/pages/AuthPage.tsx` | Removed unintended CHETNA branding only. |
| `package.json`, `bun.lock` | Added missing jsdom and Testing Library packages required by existing tests. |
| `AGENTS.md` | Shared provider and reading-state architecture rules. |
| `roadmap.md` | Updated task completion state. |
| `API_FIX_REPORT.md` | This report and setup guidance. |

No styling, routes, model training artifacts, emission factors, green-cover analysis or calculator formulas were changed. Existing dataset-contract keys named `chetna` remain intact; there are no CHETNA descriptions in pages or components.

## Verification

- Automated regression suite: **33 tests passed across 6 files**.
- Latest automatic preview compilation and typecheck: **build OK**. No manual production build was run; published-runtime behavior remains unverified.
- Signed-in browser: all eight CO₂ zones returned live inputs and estimates; overview subtitle corrected; both live-monitoring regions displayed four zones each.
- Failed readings request: actual prior readings remained visible with original timestamps, explicit stale labels and visible error. Same-tab full reload retained those stale readings; recovery via Refresh succeeded.
- Area map rendered with all eight zones; green-cover page rendered its existing dataset.
- Existing calculator checks: default tree inputs 10 trees/100 m² returned 217.7 kg/year; default personal-footprint inputs returned 4,070.4 kg/year. No page runtime errors were observed.
- Lint was run and failed with **953 formatting errors and 11 warnings** across the project. These are formatter complaints and fast-refresh/ref-cleanup warnings, not compilation errors; a repository-wide formatting rewrite was deliberately not performed.

## Setup and deployment

Required private server variables: `OPENWEATHER_API_KEY` and `TOMTOM_API_KEY`. They are already saved in this project's secure settings. Never create `VITE_` versions of either or commit them to source.

If a failure recurs:
- “key not configured”: ensure the variable name above is exact, the secret is saved for the environment being used, and the running application has received that configuration.
- HTTP 401/403: check key activation, expiry, authorization for OpenWeather current weather/air pollution and TomTom Traffic Flow, and any provider restrictions.
- HTTP 429: check usage/quota and plan in the relevant API account; do not repeatedly refresh.
- Timeout/network/5xx: transient provider/connectivity issue; bounded retries already apply.

The source ZIP excludes secrets, Git/editor metadata, dependencies and generated output. For local use, install Bun, run `bun install`, provide your own project authentication configuration (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`, and corresponding server values if needed) and the two server-only API keys through your local runtime environment, then run `bun run dev`. Existing Cloud authentication configuration is managed by Lovable in the editor. Run tests with `bunx vitest run`.

## Limits

No publication was requested, so no deployed instance was tested or changed. Provider account quotas/restrictions were not inspected in external dashboards. Same-tab environmental storage is optional and browser-dependent; CO₂ predictions themselves are not persisted across a hard reload. Traffic cache is process-local and cannot deduplicate across independent server instances. Existing calculator copy claiming environment-configurable coefficients and unrelated legacy lint/style issues were left unchanged.