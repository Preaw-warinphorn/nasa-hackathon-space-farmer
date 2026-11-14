<p align="center"><img src="public/logo-full.png" alt="AcreCast AU" width="320" /></p>

# AcreCast AU 🛰️🌾

**NASA Space Apps Challenge 2026 — Field Shift: Adapting Farms with NASA Data**

Space-powered crop investment & harvest forecaster for Australian farmland. Pick a paddock, and AcreCast ranks six
broadacre crops by risk-adjusted net return, predicts days to harvest, and shows the dollars — all from live NASA data.

## How it works

1. **Live NASA POWER data.** For the chosen point the browser downloads ~10 years of daily
   [NASA POWER](https://power.larc.nasa.gov/) agroclimatology (`T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`,
   `ALLSKY_SFC_SW_DWN`) in one request (no API key, CORS-enabled). Responses are cached in `localStorage` for 12 h and
   reused if the network drops.
2. **Subsoil water bucket.** The latest `GWETROOT` (root-zone wetness) × the soil's plant-available water capacity
   (PAWC) is the water the next crop starts with.
3. **Analogue-season replay.** The coming season is replayed against every past year of real NASA weather at that
   location. For each year and crop the engine
   - accumulates growing degree days `GDD = max(0, (Tmax+Tmin)/2 − Tbase)` until the crop's thermal target → **days to harvest**
   - counts heat-stress (Tmax > crop threshold) and frost (Tmin < 1 °C) days during flowering/grain fill
   - runs a water balance (stored water + 80 % of in-season rain vs crop demand); yield falls to zero as water
     runs out — below 20 % of demand the crop sets no grain, and drought-sensitive crops drop off faster
   - converts yield to revenue, cost, profit
4. **Risk-adjusted ranking.** Score = expected ROI (saturating), minus the share of past seasons that lost money,
   plus a legume nitrogen credit. Off-season crops are always listed below every in-season crop.
5. **Climate Stress Time Machine.** Rainfall (−50…+40 %) and heatwave (+0…+4 °C) sliders perturb every replayed year.

**Farmer Mode** shows the decision; **NASA Telemetry Mode** adds the raw NASA vector, per-crop stress counts, and the
year-by-year replay table. **Export Prospectus** prints a one-page summary.

## Develop

```bash
npm install
npm run dev        # http://localhost:5173
npm test           # engine + parser unit tests (vitest)
npm run build      # static site in dist/
npm run preview    # serves dist/ on 127.0.0.1:4173
```

## Layout

| Path | What |
|---|---|
| `src/nasa/power.ts` | NASA POWER client, parser, cache — the only code that talks to NASA |
| `src/engine/model.ts` | Pure agronomic & economic engine (tested in `model.test.ts`) |
| `src/data/crops.ts`, `src/data/hubs.ts` | Crop parameters / economics and preset farming hubs |
| `src/components/` | UI panels (map, telemetry, leaderboard, deep-dive, NASA data page) |
| `public/logo-*.png`, `favicon.png` | Web-sized logo assets; the original artwork is `brand/AcreCast_logo.png` |

## Caveats

- Crop prices, costs and potential yields are indicative benchmarks carried over from the original mockup — update
  them with current GRDC / ABARES figures before relying on the dollar values.
- `GWETROOT` is used directly as the bucket fill fraction; it is a model-based wetness index, not a calibrated PAWC
  measurement. NASA SMAP and ECOSTRESS are natural next data sources (add them next to `src/nasa/power.ts`).
- Not financial advice.
