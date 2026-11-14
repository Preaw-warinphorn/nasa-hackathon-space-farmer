// Australian crop matrix: agronomic parameters and economics, all per HECTARE.
//
// Yield model inputs follow standard Australian dryland-cropping relations:
//  • water-limited yield (French & Schultz 1984): Y = WUE × (soil water + season rain − E)
//  • radiation-limited yield: Y = RUE × intercepted solar radiation × harvest index
// WUE values are *attainable on-farm* figures, calibrated so the model's long-run yields at the
// demo hubs sit close to ABARES state-average yields for 2016–2025 (see src/data/validation.ts).
//
// Prices: farm-gate = ABARES weekly export price (FOB port) minus a freight & handling allowance.
// Chickpeas: ABARES quarterly delivered price (Crop Report Sept 2026, Table 17) less freight.
// Mungbeans have no ABARES price series: farm-gate price quoted by the Australian Mungbean Association for the 2026 crop.
// Costs: indicative variable costs (seed, fertiliser, chemicals, operations, harvest, levies) in the
// range of recent NSW DPI / GRDC gross-margin budgets. Edit them in the app's "Prices & costs" panel.

export type Season = 'winter' | 'spring'

export interface Crop {
  id: string
  name: string
  category: string
  icon: string
  /** Base temperature for growing-degree-day accumulation (°C). */
  tBase: number
  /** Thermal time from sowing to harvest maturity (°C·d). */
  targetGdd: number
  /** Attainable grain water-use efficiency (kg grain / ha / mm of water used). */
  wueKgHaMm: number
  /** Water lost to soil evaporation before the crop can use it (mm), the "E" in French–Schultz. */
  evapLossMm: number
  /** Radiation-use efficiency (g biomass / MJ intercepted). */
  rueGPerMj: number
  /** Share of biomass that ends up as grain. */
  harvestIndex: number
  /** Agronomic ceiling for a dryland crop (t/ha). */
  maxYieldTHa: number
  /** 0–1, how well the crop holds up under drought (used for labels). */
  droughtTolerance: number
  /** Max daily temperature above which flowering/grain fill is damaged (°C). */
  heatThresholdC: number
  /** Fractional yield loss per heat-stress day during flowering/grain fill. */
  heatLossPerDay: number
  /** Fractional yield loss per frost day during flowering/grain fill. */
  frostLossPerDay: number
  /** Optional cool-flowering limit: days during flowering with mean temperature below this (°C)
   *  fail to set pods (chickpea needs a daily mean above ~15 °C). */
  podSetMinMeanC?: number
  /** Fractional yield loss per cool flowering day. */
  coolLossPerDay?: number
  /** Tropical crops: minimum mean air temperature over the first week after sowing (°C, a proxy for the
   *  "soil at 16 °C and rising" rule). Colder than this and the crop fails to establish. */
  minSowMeanTempC?: number
  /** Tropical crops: a killing frost (2 m minimum at or below KILLING_FROST_C) at any stage kills the crop. */
  frostKills?: boolean
  /** Farm-gate price (A$/t). */
  priceAudPerT: number
  priceSource: string
  /** Variable growing cost (A$/ha). */
  costAudPerHa: number
  /** Next-season soil nitrogen effect (kg N/ha, positive = fixed by legume). */
  nitrogenKgHa: number
  preferredSeason: Season
  /** Dryland crop only grown commercially in eastern Australia's summer-rainfall zone. */
  summerRainfallZoneOnly?: boolean
  description: string
}

/** Northern grains region with reliable summer rain: eastern Australia north of ~33°S
 *  (central-west/northern NSW and Queensland). Dryland sorghum and mungbeans are grown here. */
export const SUMMER_ZONE_SOUTH_LIMIT_LAT = -33
export const SUMMER_ZONE_WEST_LIMIT_LON = 138

export function isRegionallySuited(crop: Crop, lat: number, lon: number): boolean {
  if (!crop.summerRainfallZoneOnly) return true
  return lat > SUMMER_ZONE_SOUTH_LIMIT_LAT && lon > SUMMER_ZONE_WEST_LIMIT_LON
}

/** Freight, receival and port charges deducted from FOB port prices to get a farm-gate price. */
export const FREIGHT_HANDLING_AUD_PER_T = 60
export const PRICE_DATE = '11 Nov 2026'
/** ABARES Australian Crop Report Sept 2026, Table 17: chickpeas, domestic delivered Melbourne, 2026 Q2 average (A$/t). */
const CHICKPEA_DEL_MELB = 728.846
const abares = (fob: number, grade: string) => ({
  priceAudPerT: fob - FREIGHT_HANDLING_AUD_PER_T,
  priceSource: `ABARES ${grade} $${fob}/t FOB, ${PRICE_DATE}, less $${FREIGHT_HANDLING_AUD_PER_T}/t freight & handling`,
})

export const CROPS: Crop[] = [
  {
    id: 'wheat',
    name: 'ASW Wheat',
    category: 'Staple winter cereal',
    icon: '🌾',
    tBase: 0,
    targetGdd: 1900,
    wueKgHaMm: 15,
    evapLossMm: 110,
    rueGPerMj: 1.24,
    harvestIndex: 0.4,
    maxYieldTHa: 6,
    droughtTolerance: 0.65,
    heatThresholdC: 32,
    heatLossPerDay: 0.02,
    frostLossPerDay: 0.03,
    ...abares(406, 'ASW wheat (Port Adelaide)'),
    costAudPerHa: 480,
    nitrogenKgHa: -50,
    preferredSeason: 'winter',
    description: "Australia's volume staple. Needs stored water plus spring rain through heading and grain fill.",
  },
  {
    id: 'barley',
    name: 'Feed/Malt Barley',
    category: 'Winter cereal',
    icon: '🍺',
    tBase: 0,
    targetGdd: 1750,
    wueKgHaMm: 16,
    evapLossMm: 110,
    rueGPerMj: 1.24,
    harvestIndex: 0.42,
    maxYieldTHa: 6.5,
    droughtTolerance: 0.75,
    heatThresholdC: 32,
    heatLossPerDay: 0.015,
    frostLossPerDay: 0.02,
    ...abares(360, 'feed barley (Port Adelaide)'),
    costAudPerHa: 450,
    nitrogenKgHa: -35,
    preferredSeason: 'winter',
    description: 'Quicker-maturing winter cereal that copes with a dry finish a little better than wheat.',
  },
  {
    id: 'canola',
    name: 'Canola (Oilseed)',
    category: 'Oilseed',
    icon: '🌼',
    tBase: 5,
    targetGdd: 1500,
    wueKgHaMm: 9,
    evapLossMm: 110,
    rueGPerMj: 1.0,
    harvestIndex: 0.28,
    maxYieldTHa: 3.5,
    droughtTolerance: 0.4,
    heatThresholdC: 29,
    heatLossPerDay: 0.03,
    frostLossPerDay: 0.02,
    ...abares(770, 'canola (Kwinana)'),
    costAudPerHa: 600,
    nitrogenKgHa: -65,
    preferredSeason: 'winter',
    description: 'High value in good seasons, but expensive to grow and badly hurt by a dry spring.',
  },
  {
    id: 'chickpea',
    name: 'Desi Chickpeas',
    category: 'Pulse / legume',
    icon: '🌱',
    tBase: 0,
    targetGdd: 1850,
    wueKgHaMm: 10,
    evapLossMm: 120,
    rueGPerMj: 1.0,
    harvestIndex: 0.38,
    maxYieldTHa: 3.5,
    droughtTolerance: 0.8,
    heatThresholdC: 32,
    heatLossPerDay: 0.025,
    frostLossPerDay: 0.03,
    podSetMinMeanC: 15,
    coolLossPerDay: 0.003,
    priceAudPerT: Math.round(CHICKPEA_DEL_MELB - FREIGHT_HANDLING_AUD_PER_T),
    priceSource: `ABARES Crop Report Sept 2026 (Table 17): chickpeas delivered Melbourne, Apr–Jun 2026 avg $${CHICKPEA_DEL_MELB.toFixed(0)}/t, less $${FREIGHT_HANDLING_AUD_PER_T}/t freight. Volatile with Indian import policy`,
    costAudPerHa: 480,
    nitrogenKgHa: 55,
    preferredSeason: 'winter',
    description: 'Drought-hardy pulse that fixes nitrogen for the next cereal. Price is volatile.',
  },
  {
    id: 'sorghum',
    name: 'Grain Sorghum',
    category: 'Summer coarse grain',
    icon: '🌾',
    tBase: 10,
    targetGdd: 1650,
    wueKgHaMm: 19,
    evapLossMm: 150,
    rueGPerMj: 1.4,
    harvestIndex: 0.45,
    maxYieldTHa: 8,
    droughtTolerance: 0.85,
    heatThresholdC: 38,
    heatLossPerDay: 0.01,
    frostLossPerDay: 0.08,
    minSowMeanTempC: 16,
    frostKills: true,
    ...abares(443, 'grain sorghum (Brisbane)'),
    costAudPerHa: 650,
    nitrogenKgHa: 0,
    preferredSeason: 'spring',
    summerRainfallZoneOnly: true,
    description: 'C4 summer crop that handles heat. Best on deep clays with a full soil-water profile.',
  },
  {
    id: 'mungbean',
    name: 'Mungbeans',
    category: 'Summer pulse',
    icon: '🫘',
    tBase: 10,
    targetGdd: 1100,
    wueKgHaMm: 6,
    evapLossMm: 150,
    rueGPerMj: 1.0,
    harvestIndex: 0.33,
    maxYieldTHa: 2.5,
    droughtTolerance: 0.7,
    heatThresholdC: 38,
    heatLossPerDay: 0.015,
    frostLossPerDay: 0.08,
    minSowMeanTempC: 16,
    frostKills: true,
    priceAudPerT: 1500,
    priceSource: 'Australian Mungbean Association (president J. Hunt, mid-2026): $1,500–1,700/t to the farmer for the 2026 crop, “extremely high”; low end used as the market is expected to ease',
    costAudPerHa: 450,
    nitrogenKgHa: 35,
    preferredSeason: 'spring',
    summerRainfallZoneOnly: true,
    description: 'Short-season summer pulse that can catch summer rain, but yields are erratic.',
  },
]

export function formatNitrogen(kg: number): string {
  if (kg > 0) return `+${kg} kg/ha free N`
  if (kg < 0) return `${kg} kg/ha N removed`
  return 'Nitrogen neutral'
}
