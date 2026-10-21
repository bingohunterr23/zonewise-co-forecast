# Model accuracy and limitations

All numbers below were produced by `ml/train_model.py` and `ml/train_co2_model.py` on held-out test data and are stored in the `metrics` field of each model JSON.

## Results

| Model | Test R² | Test MAE | Reference baseline | Notes |
|---|---|---|---|---|
| Air-quality CO₂-equivalent RF (`src/lib/ml/model.json`) | **0.515** | 17.9 ppm | predict-the-mean: R² -0.03 | Chronological split (last 20% of time). Beats the baseline clearly. |
| Traffic-flow RF (`src/lib/co2/co2-model.json`) | **0.398** | 574 vehicles/h (mean flow 1,219) | hour-of-day mean: R² 0.30 (hour + weekend mean: ≈0.40) | Beats an hour-only table but is on par with an hour + weekday/weekend table. |
| State CO₂ RF (context only, not used in zone estimates) | **0.778** | 27 Mt | linear fit on energy use: R² 0.767 | Near-identical to the simple baseline. |

## What changed in this version
- The air-quality model previously scored R² = -0.13 (worse than predicting the average). Cause: the `month` feature. With a time-ordered split, the test months (Feb–Apr 2005) are a different regime from the training months, and the forest had memorised month → level. `month` was removed. The choice was made on a validation slice taken from the training period, not on the test set. Test R² is now 0.515.
- Baseline R² values are now saved in each model's metrics so every score can be read against a simple reference.

## Limitations (please state these when presenting)
1. **Data.** No public ground-truth dataset of real-time traffic and CO₂ for Bengaluru zones exists. The traffic file has no calendar dates, weather has almost no effect in it (Clear 1,223 vs Foggy 1,185 vehicles), and vehicles never exceed road capacity, which suggests it is synthetic or generated. The air-quality data (UCI, 2004–05) was measured in an Italian city, not Bengaluru. The state CO₂ table shows implausible jumps (e.g. Karnataka 26 → 92 → 172 → 240 Mt in consecutive years).
2. **Target.** The air-quality target is derived from measured CO using an assumed 30:1 CO₂:CO ratio on a 420 ppm background. It is a proxy, not a measured CO₂ concentration.
3. **Zone CO₂ estimate (kg/h).** It equals predicted vehicles/h × link length × a fleet-average factor (81.6 g/vehicle-km). Link length is a straight-line lower bound. Emission factors and the fleet mix come from 2007 sources (ARAI, RITES), with the mix measured at one road. No speed correction is applied. This figure has **not** been validated against any measured emissions, so it is an order-of-magnitude estimate.
4. **Live inputs.** Estimates need OpenWeather and TomTom API keys. Without them the zone is reported as unavailable rather than filled with invented values.

## Future work
- Log live TomTom/OpenWeather readings per zone and retrain on that data.
- Validate estimates against CPCB/OpenAQ station readings for Bengaluru.
- Replace the 2007 emission factors and add a speed-dependent correction (COPERT).
