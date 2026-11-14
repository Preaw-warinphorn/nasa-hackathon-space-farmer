// Australian crop matrix & agronomic parameters.
// Economic values are indicative GRDC / ABARES-style benchmarks (AUD) carried over
// from the original mockup — replace with current-season figures before relying on them.

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
  /** Seasonal crop water demand (mm). */
  waterDemandMm: number
  /** 0–1, how well yield holds up under water deficit. */
  droughtTolerance: number
  /** Max daily temperature above which flowering/grain fill is damaged (°C). */
  heatThresholdC: number
  /** Fractional yield loss per heat-stress day during flowering/grain fill. */
  heatLossPerDay: number
  /** Fractional yield loss per frost day during flowering/grain fill. */
  frostLossPerDay: number
  /** Potential yield under no stress (t/acre). */
  baseYieldAc: number
  priceAudPerT: number
  costAudPerAc: number
  /** Next-season soil nitrogen effect (kg N/ha, positive = fixed by legume). */
  nitrogenKgHa: number
  preferredSeason: Season
  description: string
}

export const CROPS: Crop[] = [
  {
    id: 'chickpea',
    name: 'Desi Chickpeas',
    category: 'Pulses / Legumes',
    icon: '🌱',
    tBase: 5,
    targetGdd: 1450,
    waterDemandMm: 220,
    droughtTolerance: 0.85,
    heatThresholdC: 32,
    heatLossPerDay: 0.02,
    frostLossPerDay: 0.03,
    baseYieldAc: 1.1,
    priceAudPerT: 950,
    costAudPerAc: 240,
    nitrogenKgHa: 55,
    preferredSeason: 'winter',
    description: 'Superior drought resilience. Fixes atmospheric nitrogen for subsequent cereals.',
  },
  {
    id: 'sorghum',
    name: 'Grain Sorghum',
    category: 'Coarse Summer Grain',
    icon: '🌾',
    tBase: 10,
    targetGdd: 1850,
    waterDemandMm: 250,
    droughtTolerance: 0.9,
    heatThresholdC: 38,
    heatLossPerDay: 0.01,
    frostLossPerDay: 0.08,
    baseYieldAc: 1.8,
    priceAudPerT: 340,
    costAudPerAc: 220,
    nitrogenKgHa: 0,
    preferredSeason: 'spring',
    description: 'C4 physiology tolerates 35°C+ heat. Ideal summer rotation when subsoil moisture is deep.',
  },
  {
    id: 'barley',
    name: 'Feed/Malt Barley',
    category: 'Winter Cereal',
    icon: '🍺',
    tBase: 0,
    targetGdd: 1400,
    waterDemandMm: 280,
    droughtTolerance: 0.75,
    heatThresholdC: 30,
    heatLossPerDay: 0.015,
    frostLossPerDay: 0.02,
    baseYieldAc: 1.5,
    priceAudPerT: 310,
    costAudPerAc: 230,
    nitrogenKgHa: -35,
    preferredSeason: 'winter',
    description: 'Fast-maturing winter cereal. Moderate drought tolerance and lower risk than canola.',
  },
  {
    id: 'wheat',
    name: 'ASW Winter Wheat',
    category: 'Staple Cereal',
    icon: '🌾',
    tBase: 0,
    targetGdd: 1650,
    waterDemandMm: 360,
    droughtTolerance: 0.65,
    heatThresholdC: 32,
    heatLossPerDay: 0.02,
    frostLossPerDay: 0.03,
    baseYieldAc: 1.3,
    priceAudPerT: 360,
    costAudPerAc: 280,
    nitrogenKgHa: -50,
    preferredSeason: 'winter',
    description: "Australia's volume staple. Needs sustained spring rainfall during heading and grain fill.",
  },
  {
    id: 'canola',
    name: 'Canola (Oilseed)',
    category: 'Oilseeds',
    icon: '🌼',
    tBase: 5,
    targetGdd: 1600,
    waterDemandMm: 420,
    droughtTolerance: 0.4,
    heatThresholdC: 29,
    heatLossPerDay: 0.03,
    frostLossPerDay: 0.02,
    baseYieldAc: 0.85,
    priceAudPerT: 720,
    costAudPerAc: 380,
    nitrogenKgHa: -65,
    preferredSeason: 'winter',
    description: 'High upside in wet seasons, but severe loss risk in low subsoil-moisture years.',
  },
  {
    id: 'mungbean',
    name: 'Mungbeans',
    category: 'Fast Cash Pulse',
    icon: '🫘',
    tBase: 10,
    targetGdd: 1050,
    waterDemandMm: 160,
    droughtTolerance: 0.8,
    heatThresholdC: 38,
    heatLossPerDay: 0.015,
    frostLossPerDay: 0.08,
    baseYieldAc: 0.65,
    priceAudPerT: 1050,
    costAudPerAc: 200,
    nitrogenKgHa: 35,
    preferredSeason: 'spring',
    description: 'Fast-turnaround opportunity crop to capture summer rainfall events.',
  },
]

export function formatNitrogen(kg: number): string {
  if (kg > 0) return `+${kg} kg/ha free N`
  if (kg < 0) return `${kg} kg/ha N removed`
  return 'Nitrogen neutral'
}
