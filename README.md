<p align="center"><img src="public/logo-full.png" alt="AcreCast AU" width="320" /></p>

# AcreCast AU 🛰️🌾

**NASA Space Apps Challenge 2026 — Field Shift: Adapting Farms with NASA Data**

Space-powered crop investment & harvest forecaster for Australian farmland. Pick a paddock, and AcreCast ranks six
broadacre crops by risk-adjusted net return, predicts days to harvest, and shows the dollars — all from live NASA data.

## How it works

1. **Live NASA POWER data.** For the chosen point the browser downloads ~10 years of daily
   [NASA POWER](https://power.larc.nasa.gov/) agroclimatology (`T2M_MAX`, `T2M_MIN`, `PRECTOTCORR`, `GWETROOT`,
   `ALLSKY_SFC_SW_DWN`) in one request (no API key, CORS-enabled). Responses are cached in `localStorage` for 12 h.
2. **Analogue-season replay.** The coming season is replayed against every past year of real NASA weather at that
   location, sown on the same calendar day. Sowing defaults to the next window (today, if we're inside one).
3. **Soil water at sowing.** `GWETROOT` is a saturation index, not plant-available water, so it is rescaled between the
   site's own dry end (1st percentile ≈ wilting point) and wet end (90th percentile ≈ field capacity), then × PAWC.
   Each past season starts from *its own* soil water on its sowing day; only when sowing is within 30 days does every
   replay start from today's measured value.
4. **Yield.** For each year and crop:
   - growing degree days to the crop's thermal target → **days to harvest**
   - water-limited yield (French–Schultz): `WUE × (soil water + in-season rain + irrigation − E)`
   - sunlight-limited yield: `season solar × 50 % interception × RUE × harvest index`
   - yield = the lower of the two, minus heat / frost (and, for chickpea, cool-flowering) damage, × rotation effect
5. **Validated against ABARES.** Crop WUE values are calibrated so modelled yields at the six hubs match ABARES
   state-average yields for 2014–2025 (pooled means, model vs ABARES t/ha: wheat 2.24 vs 2.32, barley 2.26 vs 2.50,
   canola 1.41 vs 1.56, chickpea 1.12 vs 1.28; year-to-year correlation r ≈ 0.6–0.75 for cereals and canola).
   The app's **Model vs reality** chart shows this comparison live for any point and crop.
6. **Economics per hectare.** Grain prices are ABARES weekly export prices (11 Nov 2026) less $60/t freight & handling;
   chickpeas use the ABARES Crop Report (Sept 2026, Table 17) delivered-Melbourne price for Apr–Jun 2026, less the same
   freight allowance. The mungbean price and all growing costs are indicative and editable in the **Prices & costs** panel.
   Gross margin = yield × price − variable growing costs (so "return" is on variable costs).
7. **Risk-adjusted ranking.** Score = expected return (saturating) minus the share of past seasons that lost money.
   Off-season crops always rank last. When no crop is expected to pay, the app says so and points to the other window.
8. **Climate Stress Time Machine.** Rainfall (−50…+40 %) and heatwave (+0…+4 °C) sliders perturb every replayed year.

Units default to hectares (toggle to acres in the header). **Farmer Mode** shows the decision; **NASA Telemetry Mode**
adds the raw NASA vector, the yield-limit breakdown and the year-by-year replay table. **Print crop plan** prints a summary.

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
| `src/data/crops.ts`, `src/data/hubs.ts` | Crop parameters / economics (per ha, with price sources) and preset farming hubs |
| `src/data/validation.ts` | ABARES state yields 2014–2025 for the Model vs reality check |
| `src/data/rotation.ts` | Previous-crop rotation rules and irrigation cost |
| `src/components/` | UI panels (map, telemetry, leaderboard, deep-dive, NASA data page) |
| `public/logo-*.png`, `favicon.png` | Web-sized logo assets; the original artwork is `brand/AcreCast_logo.png` |

## Caveats

- Validation is against **state** averages; a single paddock swings more than its state. District-level yields would
  be a better test.
- Growing costs and the mungbean price are indicative, not taken from a published budget. Check them against
  current NSW DPI / GRDC gross-margin budgets and enter your own in the app.
- The wilting-point rescaling of `GWETROOT` uses the site's own record, not a soil test. NASA SMAP and ECOSTRESS
  are natural next data sources (add them next to `src/nasa/power.ts`).
- Indicative planning tool, not financial advice.
