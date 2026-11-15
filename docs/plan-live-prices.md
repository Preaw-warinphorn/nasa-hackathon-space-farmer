# Plan: live crop prices

**Status:** partly done · researched 14 Nov 2026 · updated 15 Nov 2026

Prices are now sourced and dated, and users can edit prices and costs. They are still entered by hand:
the automatic weekly update (steps 1–3) and the remaining items in "Still to do" are not built.

## Problem

Crop prices, costs and potential yields in `src/data/crops.ts` were fixed numbers copied from the original mockup.
The mockup labelled them "GRDC / ABARES benchmarks" but cited no report or year, and they had not been verified.

## Done so far

Prices in `src/data/crops.ts` now come from cited sources, with the source and date stored in each crop's `priceSource`.
For the ABARES export prices, the farm-gate price is the FOB port price less a flat $60/t freight and handling
allowance (`FREIGHT_HANDLING_AUD_PER_T`), which answers decision 2 below.

| Crop | Mockup price ($/t) | Price used now ($/t, farm-gate) | Source |
|---|---|---|---|
| Wheat | 360 | 346 | ABARES ASW $406 FOB Port Adelaide, 11 Nov 2026, less $60 |
| Feed barley | 310 | 300 | ABARES $360 FOB Port Adelaide, 11 Nov 2026, less $60 |
| Canola | 720 | 710 | ABARES $770 FOB Kwinana, 11 Nov 2026, less $60 |
| Grain sorghum | 340 | 383 | ABARES $443 FOB Brisbane, 11 Nov 2026, less $60 |
| Desi chickpeas | 950 | 669 | ABARES Crop Report Sept 2026, Table 17: delivered Melbourne, Apr–Jun 2026 avg $729, less $60 |
| Mungbeans | 1,050 | 1,500 | Australian Mungbean Association, 2026 crop: $1,500–1,700/t to the farmer (low end used) |

Also done:
- **Prices & costs panel** (`src/components/EconomicsPanel.tsx`): lists each crop's price, growing cost and source, lets
  users override price and cost per crop, and has "Reset to defaults". Overrides flow into the ranking and every dollar
  figure (step 5, except that edits are not yet saved between visits).
- **Step 6** (chickpeas and mungbeans): defaults updated with a cited, dated figure.

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

## Decisions still needed

1. **Permission:** OK for the app to read the ABARES page automatically each week? Note the third-party (Jumbuk AG)
   attribution: credit it on screen, and confirm the terms if the app goes beyond the hackathon.
2. ~~**Port vs farm-gate:**~~ Decided: subtract a flat $60/t freight and handling allowance. A regional figure would
   be better, and the $60 still needs a cited source.

## Steps

Steps 1–4 (automatic weekly update) are not started. Steps 5 and 6 are mostly done (see above).

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

## Still to do

- Steps 1–3: fetch ABARES prices automatically each week instead of editing `crops.ts` by hand.
- Step 4: show each price's source on the deep-dive card (today it is only in the Prices & costs panel), and credit
  Jumbuk AG for the ABARES domestic grain prices.
- Step 5: save user-entered prices and costs in `localStorage`.
- Step 7: growing costs are still indicative and uncited; source them from GRDC gross margin guides.
- Cite a source for the $60/t freight and handling allowance.

## Done when

- Wheat, barley, canola and sorghum prices update weekly without manual work, and the date and source are visible.
- Every financial number in the UI shows where it came from (live, benchmark, or user-entered).
- Users can enter their own prices and costs.
- Parser has tests; a failed update leaves the last good prices in place.
