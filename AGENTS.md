<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Live environmental inputs use OpenWeather when configured and Open-Meteo's public current weather/air-quality feeds otherwise, so zone predictions never depend on invented sensor values.
- Zone predictions must use fresh per-zone readings and complete model features; missing values make that zone unavailable instead of being filled from training averages.
- The CO₂ Prediction module (src/lib/co2*, PredictionPage) is self-contained: two separately trained Random Forests (ml/train_co2_model.py) combined only at prediction time, because the hourly traffic and yearly state CO₂ datasets cannot be merged row-wise.
- CO₂ estimates use a fleet-weighted emission-factor method (per-category factors × vehicle shares in src/lib/co2/co2.server.ts FLEET) with cited sources, because only sourced coefficients are allowed; speed corrections need verified COPERT coefficients first.
- Large datasets are stored gzipped under ml/datasets to stay under the repo file-size limit.
- Live traffic for every module comes from src/lib/traffic/live-traffic.server.ts (cached per zone) and is labelled by classifyTraffic in src/lib/co2/traffic-condition.ts, so all pages agree and TomTom isn't called twice for the same reading.

- Provider HTTP transport lives in a shared server-only helper with bounded timeouts, deduplication, short-lived raw-response caching, and sanitized failures to prevent quota bursts and secret leakage. Predictions are never cached as substitutes for fresh model inputs.
- Browser reading state retains only successful per-zone data with original timestamps and explicit stale/error status so refresh failures cannot masquerade as live results.
