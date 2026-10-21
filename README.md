# Accurate Zone Predictions

Fix the CO₂ prediction issue: all zones are currently returning the same predicted value. Do not change the existing UI. Trace the complete pipeline from zone selection → latitude/longitude → live OpenWeather/emission data → feature mapping → trained Random Forest → prediction. Verify that each zone sends its own real input values to the model and that the model prediction is generated from those inputs. Remove any hardcoded, cached, default, or fallback prediction values. Add backend logs showing the zone ID, model input features, and prediction for debugging. Do not use fake/random values.

This project was built with [Lovable](https://lovable.dev).

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/a412b0f7-2dc5-41ad-b0f7-fdb98469a669).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
