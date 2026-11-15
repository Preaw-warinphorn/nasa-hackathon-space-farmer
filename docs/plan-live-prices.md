# Plan: live crop prices

**Status:** not started · researched 14 Nov 2026

## Problem

Crop prices, costs and potential yields in `src/data/crops.ts` are fixed numbers copied from the original mockup.
The mockup labels them "GRDC / ABARES benchmarks" but cites no report or year, and they have not been verified.
Judges or farmers asking "where do your prices come from?" currently get no good answer.

| Crop | Price now ($/t) | ABARES 11 Nov 2026 (A$/t, FOB port) |
|---|---|---|
| Wheat | 360 | 406 (ASW) / 417 (APW), FOB Port Adelaide |
| Feed barley | 310 | 360, FOB Port Adelaide |
| Canola | 720 | 770, FOB Kwinana |
| Grain sorghum | 340 | 443, FOB Brisbane |
| Desi chickpeas | 950 | no live source |
| Mungbeans | 1,050 | no live source |

## Sources evaluated

| Source | Coverage | Access | Verdict |
|---|---|---|---|
| [ABARES weekly commodity price update](https://www.agriculture.gov.au/abares/data/weekly-commodity-price-update) | Wheat (APW, ASW), feed barley, canola, sorghum; A$/t; updated Thursdays | HTML table only; no CORS, so it can't be fetched from the browser | **Use**: official Australian prices |
| [IMF Primary Commodity Prices API](https://data.imf.org/en/datasets/IMF.RES%3APCPS) | Wheat, barley, sorghum, chickpea (India), rapeseed oil; monthly USD world prices | JSON API, CORS `*` (tested) | Fallback / trend only: units inconsistent (sorghum labelled "USD per pound" reads 11.8; chickpea "INR/100 kg" reads 76) |
| [CBH live grain prices](https://www.cbh.com.au/marketing-and-trading/live-grain-prices) | Cash prices | Grower login | Not usable |
| Chickpeas / mungbeans | — | No free live feed found; news only (chickpeas toward ~$1,000/t delivered, Oct 2026) | Keep as dated benchmarks |

ABARES table, for parsing: page `https://www.agriculture.gov.au/abares/data/weekly-commodity-price-update`,
section "Selected Australian grain export prices". Rows have the form
`<name> | <date e.g. 11-Nov> | A$/t | latest | previous week | weekly change | 12 months ago | annual change`.
ABARES credits domestic grain prices to Jumbuk AG ([data attribution](https://www.agriculture.gov.au/abares/products/weekly_update/data-attribution)).

## Decisions needed before starting

1. **Permission:** OK for the app to read the ABARES page automatically each week? Note the third-party (Jumbuk AG)
   attribution: credit it on screen, and confirm the terms if the app goes beyond the hackathon.
2. **Port vs farm-gate:** show FOB port prices as-is (labelled), or subtract a freight/handling allowance?
   If subtracting, choose the figure and its source.

## Steps

1. **Price fetcher script:** `scripts/update-prices.mjs`
   - Fetch the ABARES page and parse the "Selected Australian grain export prices" rows.
   - Map rows to crop ids: ASW wheat → `wheat`, feed barley → `barley`, canola → `canola`, grain sorghum → `sorghum`.
   - Write `public/prices.json`: `{ updated, source, sourceUrl, attribution, prices: { wheat: { audPerT, basis, date } … } }`.
   - Fail safe: if parsing finds fewer rows than expected, keep the previous file and exit non-zero (the page layout may change).
   - Unit test the parser against a saved copy of the page.
2. **Schedule it:** run weekly (Thursday evening AEST, after ABARES updates) via a user crontab on the server,
   then `npm run build` (or copy `prices.json` into `dist/`). Also run it in `prebuild` so every build is fresh.
3. **App reads prices:** load `prices.json` at startup. A crop's price is the live price if present, else the
   benchmark in `crops.ts`. Keep each price's basis and date with it.
4. **Show provenance:** on the deep-dive card show "$406/t · ABARES, week of 11 Nov 2026 (FOB Port Adelaide)" or
   "$950/t · benchmark (unverified)". Add a "Prices" section to the NASA Data Explained page (or a new "Data sources"
   page) listing each source, date and licence/attribution.
5. **Editable prices and costs:** let users override price $/t and cost $/acre per crop (small inputs on the deep-dive
   card, stored in `localStorage`, with "reset to market price"). Overrides apply to ranking and the printed prospectus.
6. **Chickpeas and mungbeans:** keep benchmarks; update the defaults with a cited recent figure and date. Optionally show
   the IMF chickpea series as a trend indicator only, once its units are confirmed.
7. **Separately:** costs ($/acre) and potential yields are also unverified. Source them from GRDC regional
   farm gross margin guides and cite them in `crops.ts`.

## Done when

- Wheat, barley, canola and sorghum prices update weekly without manual work, and the date and source are visible.
- Every financial number in the UI shows where it came from (live, benchmark, or user-entered).
- Users can enter their own prices and costs.
- Parser has tests; a failed update leaves the last good prices in place.
