# Task roadmap

- [x] Integrate the uploaded UrbanEcoSense project without redesigning its existing screens.
- [x] Fetch uncached, coordinate-specific live data for each zone.
- [x] Remove model feature imputation and only predict from complete real inputs.
- [x] Log each zone, feature vector, provider, and Random Forest prediction server-side.
- [x] Verify all eight live zone-to-model predictions, distinct input-driven results, backend logs, and successful builds.
- [x] Diagnose the blank preview, correct the routing error-handler type mismatch, and verify login and authenticated dashboard rendering.
- [x] Trace current Bengaluru zone readings, model features, and Random Forest predictions; add exact ordered vectors and live emission context to backend logs without changing the UI.
- [x] Rework only the CO₂ Prediction module: traffic RF (Bengaluru) + emission RF (India), live TomTom traffic + OpenWeather.
- [ ] Live CO₂ estimates — waiting on OPENWEATHER_API_KEY and TOMTOM_API_KEY from the user.