// AcreCast agronomic & economic engine. Pure functions: no DOM, no network.
//
// Approach: replay the coming season against every past year of NASA POWER daily weather at this
// location (an analogue-year ensemble). For each past year and crop:
//  1. Starting soil water: if sowing is within STARTING_WATER_NOW_DAYS of today, every replay starts
//     from today's measured soil water (we know it). Otherwise each replay starts from that year's own
//     soil water on its sowing date, so drought years start dry.
//     GWETROOT is a saturation index, not plant-available water: it is rescaled between this site's
//     own dry end (≈ wilting point) and wet end (≈ field capacity) before multiplying by PAWC.
//  2. Thermal time (GDD) to maturity → days to harvest; heat & frost days during flowering.
//  3. Water-limited yield (French–Schultz): WUE × (soil water + in-season rain + irrigation − E).
//  4. Radiation-limited yield: RUE × intercepted sunlight (ALLSKY_SFC_SW_DWN) × harvest index.
//  5. Yield = min(water-, radiation-limited, crop ceiling) × heat/frost damage × rotation effect.
// The spread of outcomes across years gives an expected return *and* a downside risk.

import type { Crop, Season } from '../data/crops'
import { isRegionallySuited } from '../data/crops'
import type { PreviousCrop, RotationEffect } from '../data/rotation'
import { IRRIGATION_AUD_PER_MM_HA, rotationEffect } from '../data/rotation'
import { grainState, STATE_YIELDS_T_HA } from '../data/validation'
import type { DailySeries } from '../nasa/power'

export const MAX_SEASON_DAYS = 240
export const FROST_THRESHOLD_C = 1 // 2 m air temperature at which ground frost becomes likely
/** 2 m minimum at or below which a frost-tender (tropical) crop is killed outright. */
export const KILLING_FROST_C = 2
/** Days after sowing averaged for the establishment temperature check. */
export const ESTABLISH_DAYS = 21
export const FLOWERING_START = 0.4
export const FLOWERING_END = 0.85
/** Average share of sunlight the canopy intercepts over the whole season (low early, high mid-season). */
export const MEAN_INTERCEPTION = 0.5
/** If sowing is this close, start every replay from today's measured soil water. */
export const STARTING_WATER_NOW_DAYS = 30
/** Percentiles of a site's own GWETROOT record treated as "empty" (wilting point) and "full" (field capacity). */
export const SOIL_DRY_PCTL = 0.01
export const SOIL_WET_PCTL = 0.9
/** Fallow storage: growers keep the paddock weed-free before sowing so part of the fallow rain is stored.
 *  GWETROOT models a vegetated surface that keeps using water, so it misses this. Stored water is taken as
 *  FALLOW_EFFICIENCY × rain over the FALLOW_DAYS before sowing (northern summer fallows store ~15–30 %),
 *  and the starting water is whichever is larger: the GWETROOT reading or the fallow store. */
export const FALLOW_DAYS = 150
export const FALLOW_EFFICIENCY = 0.2
/** Local correction against ABARES: yield × √(ABARES state mean ÷ model mean at this point), limited to this
 *  range. Square-rooted (half-way) so a good paddock in an average state keeps most of its local advantage. */
export const ABARES_FACTOR_MIN = 0.8
export const ABARES_FACTOR_MAX = 1.5
/** Fewest overlapping seasons needed before the ABARES correction is applied. */
export const ABARES_FACTOR_MIN_YEARS = 5
/** Expected profit (A$/ha) at which the score is ~3/4 of the way up its curve. */
export const SCORE_PROFIT_SCALE_AUD_HA = 500
/** Score points removed for a crop that lost money in every past season (scaled by loss share). */
export const SCORE_LOSS_PENALTY = 10

/** Risk-adjusted score (0–100 before off-season/region penalties): expected profit per hectare,
 *  saturating, minus a small penalty for how often the crop lost money. Ranking by profit per hectare
 *  (not ROI) is what held up best in the 2014–2025 back-test against ABARES yields. */
export function riskScore(profitPerHa: number, lossProbability: number): number {
  return 45 + 35 * Math.tanh(profitPerHa / SCORE_PROFIT_SCALE_AUD_HA) - SCORE_LOSS_PENALTY * lossProbability
}

export interface SowingWindow {
  /** First and last calendar day (month, day) of the normal sowing window. */
  open: { month: number; day: number }
  close: { month: number; day: number }
  /** Nominal sowing day used when the window is in the future. */
  nominal: { month: number; day: number }
  label: string
}

export const SOWING_WINDOWS: Record<Season, SowingWindow> = {
  winter: { open: { month: 4, day: 15 }, close: { month: 6, day: 30 }, nominal: { month: 5, day: 15 }, label: 'Autumn/winter' },
  spring: { open: { month: 10, day: 1 }, close: { month: 12, day: 31 }, nominal: { month: 10, day: 15 }, label: 'Spring/summer' },
}

export interface Scenario {
  season: Season
  /** Paddock area in hectares. */
  areaHa: number
  rainAnomalyPct: number
  tempAnomalyC: number
  pawcMm: number
  /** Supplemental irrigation applied over the season (mm). */
  irrigationMm?: number
  /** Last season's crop on this paddock (rotation effects). */
  previousCrop?: PreviousCrop
  /** Per-crop price / cost overrides (A$/t, A$/ha). */
  economics?: Record<string, { priceAudPerT?: number; costAudPerHa?: number }>
}

export interface YearRun {
  sowYear: number
  matured: boolean
  days: number | null
  rainMm: number
  /** Plant-available soil water at sowing (mm). */
  startWaterMm: number
  heatDays: number
  frostDays: number
  /** Crop failed outright: too cold to establish, or killed by frost (frost-tender crops only). */
  failure: 'cold-sowing' | 'frost-kill' | null
  solarMj: number
  /** Water supply / (water supply needed to reach the radiation-limited yield). */
  waterRatio: number
  waterLimitedTHa: number
  radiationLimitedTHa: number
  /** Yield multiplier from heat & frost damage at flowering. */
  stressFactor: number
  yieldTHa: number
  profitPerHa: number
  profit: number
}

export interface CropResult {
  crop: Crop
  priceAudPerT: number
  costAudPerHa: number
  years: YearRun[]
  matureShare: number
  daysToHarvest: number | null
  phaseDays: { vegetative: number; flowering: number; ripening: number } | null
  sowDate: Date
  harvestDate: Date | null
  startWaterSource: 'today' | 'each-year'
  yieldTHa: number
  totalTonnes: number
  grossRevenue: number
  totalCosts: number
  netProfit: number
  roiPct: number
  lossProbability: number
  worstProfit: number
  avgHeatDays: number
  avgFrostDays: number
  /** Share of past seasons a frost-tender crop failed to establish (too cold) or was killed by frost. */
  coldFailShare: number
  avgWaterRatio: number
  avgRainMm: number
  avgStartWaterMm: number
  avgWaterLimitedTHa: number
  avgRadiationLimitedTHa: number
  avgStressFactor: number
  /** Share of seasons where water (not sunlight) set the yield. */
  waterLimitedShare: number
  irrigationCost: number
  rotation: RotationEffect
  offSeason: boolean
  /** Not grown commercially in this region (e.g. dryland summer crops in the south). */
  notSuited: boolean
  /** Off-season or not suited: listed after every recommended crop. */
  notRecommended: boolean
  score: number
  /** Local ABARES correction applied to yields (1 = none). */
  abaresFactor: number
}

export interface SiteSnapshot {
  latestDate: string
  /** Latest plant-available water as a fraction of PAWC (after wilting-point rescaling). */
  bucketFraction: number | null
  /** Latest raw GWETROOT (0–1 saturation index). */
  gwetRaw: number | null
  bucketDate: string | null
  soilDry: number
  soilWet: number
  rain90Mm: number
  rain90NormalMm: number | null
  tmaxLatest: number
  tminLatest: number
  precipLatest: number
  solarLatest: number | null
  /** Mean seasonal frost days (Tmin < threshold) across analogue years for the selected season window. */
  seasonFrostDays: number
  /** Mean GDD (base 5 °C) over a 150-day window from the sowing date. */
  seasonGdd: number
  /** Mean days with Tmax > 32 °C over the same 150-day window. */
  seasonHotDays: number
  analogueYears: number
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function quantile(xs: number[], q: number): number {
  const s = xs.filter((x) => !Number.isNaN(x)).sort((a, b) => a - b)
  if (!s.length) return NaN
  return s[Math.min(s.length - 1, Math.max(0, Math.round(q * (s.length - 1))))]
}

function indexByDate(series: DailySeries): Map<string, number> {
  const m = new Map<string, number>()
  series.dates.forEach((d, i) => m.set(d, i))
  return m
}

function isoDate(y: number, month: number, day: number) {
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

const dayOfYear = (month: number, day: number) => month * 100 + day

/** Sowing date for a season: today if we're inside the window, otherwise the next nominal date. */
export function nextSowDate(season: Season, today = new Date()): Date {
  const w = SOWING_WINDOWS[season]
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const doy = dayOfYear(t.getMonth() + 1, t.getDate())
  if (doy >= dayOfYear(w.open.month, w.open.day) && doy <= dayOfYear(w.close.month, w.close.day)) return t
  const d = new Date(t.getFullYear(), w.nominal.month - 1, w.nominal.day)
  if (d < t) d.setFullYear(d.getFullYear() + 1)
  return d
}

/** The season whose sowing date comes soonest (today counts). */
export function defaultSeason(today = new Date()): Season {
  return nextSowDate('spring', today) <= nextSowDate('winter', today) ? 'spring' : 'winter'
}

/** Sowing-day indices, on the given calendar day, for every past year whose season fits in the data. */
export function analogueStarts(series: DailySeries, sow: { month: number; day: number }, windowDays = MAX_SEASON_DAYS): { year: number; idx: number }[] {
  const idx = indexByDate(series)
  const first = Number(series.dates[0].slice(0, 4))
  const lastYear = Number(series.dates[series.dates.length - 1].slice(0, 4))
  const out: { year: number; idx: number }[] = []
  for (let y = first; y <= lastYear; y++) {
    // 29 Feb falls back to 28 Feb in non-leap years.
    const i = idx.get(isoDate(y, sow.month, sow.day)) ?? idx.get(isoDate(y, sow.month, sow.day - 1))
    if (i !== undefined && i + windowDays < series.dates.length) out.push({ year: y, idx: i })
  }
  return out
}

/** Latest valid root-zone wetness value (GWETROOT is published with a short lag). */
export function latestBucket(series: DailySeries): { value: number; date: string; index: number } | null {
  for (let i = series.gwet.length - 1; i >= 0; i--) {
    if (!Number.isNaN(series.gwet[i])) return { value: series.gwet[i], date: series.dates[i], index: i }
  }
  return null
}

export interface SoilScale {
  dry: number
  wet: number
}

/** This site's own GWETROOT dry end (≈ wilting point) and wet end (≈ field capacity). */
export function soilScale(series: DailySeries): SoilScale {
  const dry = quantile(series.gwet, SOIL_DRY_PCTL)
  const wet = quantile(series.gwet, SOIL_WET_PCTL)
  if (Number.isNaN(dry) || Number.isNaN(wet) || wet - dry < 0.05) return { dry: 0.1, wet: 0.9 }
  return { dry, wet }
}

/** GWETROOT saturation index → plant-available fraction of PAWC (0 at wilting point, 1 at field capacity). */
export function plantAvailableFraction(gwet: number, scale: SoilScale): number {
  if (Number.isNaN(gwet)) return 0.3
  return Math.min(1, Math.max(0, (gwet - scale.dry) / (scale.wet - scale.dry)))
}

/** GWETROOT near index i (the record has occasional gaps). */
/** Water stored by a weed-free fallow over the FALLOW_DAYS before day i (mm, capped at PAWC). */
export function fallowStoredMm(series: DailySeries, i: number, pawcMm: number): number {
  let rain = 0
  for (let k = Math.max(0, i - FALLOW_DAYS); k < i; k++) rain += series.precip[k]
  return Math.min(pawcMm, FALLOW_EFFICIENCY * rain)
}

function gwetNear(series: DailySeries, i: number): number {
  for (let k = 0; k < 10; k++) {
    if (!Number.isNaN(series.gwet[i - k])) return series.gwet[i - k]
    if (!Number.isNaN(series.gwet[i + k])) return series.gwet[i + k]
  }
  return NaN
}

export function dailyGdd(tmax: number, tmin: number, tBase: number): number {
  return Math.max(0, (tmax + tmin) / 2 - tBase)
}

/** Replay one season for one crop starting at series index `start`. Yields are t/ha before rotation. */
export function simulateYear(series: DailySeries, start: number, crop: Crop, sc: Scenario, startWaterMm: number) {
  let gdd = 0
  let rain = 0
  let solar = 0
  let heatDays = 0
  let frostDays = 0
  let coolDays = 0
  let days: number | null = null
  let floweringStartDay = 0
  let floweringEndDay = 0
  let failure: 'cold-sowing' | 'frost-kill' | null = null
  const rainMult = 1 + sc.rainAnomalyPct / 100
  if (crop.minSowMeanTempC !== undefined) {
    let t = 0
    let n = 0
    for (let d = 0; d < ESTABLISH_DAYS && start + d < series.dates.length; d++, n++) t += (series.tmax[start + d] + series.tmin[start + d]) / 2 + sc.tempAnomalyC
    if (n && t / n < crop.minSowMeanTempC) failure = 'cold-sowing'
  }
  let lastSolar = 15
  for (let d = 0; d < MAX_SEASON_DAYS && start + d < series.dates.length; d++) {
    const i = start + d
    const tx = series.tmax[i] + sc.tempAnomalyC
    const tn = series.tmin[i] + sc.tempAnomalyC
    gdd += dailyGdd(tx, tn, crop.tBase)
    rain += series.precip[i] * rainMult
    if (!Number.isNaN(series.solar[i])) lastSolar = series.solar[i]
    solar += lastSolar
    const frac = gdd / crop.targetGdd
    if (frac >= FLOWERING_START && !floweringStartDay) floweringStartDay = d + 1
    if (frac >= FLOWERING_START && frac < FLOWERING_END) {
      if (tx > crop.heatThresholdC) heatDays++
      if (tn < FROST_THRESHOLD_C) frostDays++
      if (crop.podSetMinMeanC !== undefined && (tx + tn) / 2 < crop.podSetMinMeanC) coolDays++
    }
    if (frac >= FLOWERING_END && !floweringEndDay) floweringEndDay = d + 1
    if (crop.frostKills && !failure && tn <= KILLING_FROST_C) failure = 'frost-kill'
    if (gdd >= crop.targetGdd) {
      days = d + 1
      break
    }
  }
  const supply = startWaterMm + rain + (sc.irrigationMm ?? 0)
  const waterLimitedTHa = (crop.wueKgHaMm * Math.max(0, supply - crop.evapLossMm)) / 1000
  // g/m² → t/ha is ×0.01.
  const radiationLimitedTHa = Math.min(crop.maxYieldTHa, solar * MEAN_INTERCEPTION * crop.rueGPerMj * crop.harvestIndex * 0.01)
  const waterNeeded = crop.evapLossMm + (radiationLimitedTHa * 1000) / crop.wueKgHaMm
  const stressFactor = Math.max(0.25, 1 - heatDays * crop.heatLossPerDay - frostDays * crop.frostLossPerDay - coolDays * (crop.coolLossPerDay ?? 0))
  const yieldTHa = days !== null && !failure ? Math.min(waterLimitedTHa, radiationLimitedTHa) * stressFactor : 0
  return {
    days,
    gdd,
    rain,
    solar,
    heatDays,
    frostDays,
    coolDays,
    waterRatio: supply / waterNeeded,
    waterLimitedTHa,
    radiationLimitedTHa,
    stressFactor,
    yieldTHa,
    floweringStartDay,
    floweringEndDay,
    /** Why the crop failed outright (too cold to establish, or killed by frost), if it did. */
    failure,
  }
}

export interface EvalOptions {
  today?: Date
  /** Force a starting-water mode (validation uses 'each-year'). */
  startWater?: 'today' | 'each-year'
  /** Multiply every season's yield by this (the local ABARES correction). Default 1. */
  yieldFactor?: number
}

export function evaluateCrop(series: DailySeries, crop: Crop, sc: Scenario, opts: EvalOptions = {}): CropResult {
  const today = opts.today ?? new Date()
  const sowDate = nextSowDate(sc.season, today)
  const sow = { month: sowDate.getMonth() + 1, day: sowDate.getDate() }
  const starts = analogueStarts(series, sow)
  const scale = soilScale(series)
  const latest = latestBucket(series)
  const daysAway = (sowDate.getTime() - today.getTime()) / 86_400_000
  const startWaterSource = opts.startWater ?? (latest && daysAway <= STARTING_WATER_NOW_DAYS ? 'today' : 'each-year')
  const todayWater = Math.max(latest ? plantAvailableFraction(latest.value, scale) * sc.pawcMm : 0, fallowStoredMm(series, series.dates.length, sc.pawcMm))

  const rotation = rotationEffect(sc.previousCrop ?? 'none', crop.id)
  const factor = opts.yieldFactor ?? 1
  const ov = sc.economics?.[crop.id]
  const price = ov?.priceAudPerT ?? crop.priceAudPerT
  const costPerHa = Math.max(100, (ov?.costAudPerHa ?? crop.costAudPerHa) - rotation.costSavingAudPerHa)
  const irrigationPerHa = (sc.irrigationMm ?? 0) * IRRIGATION_AUD_PER_MM_HA
  const costs = (costPerHa + irrigationPerHa) * sc.areaHa

  const sims = starts.map((s) => {
    const startWater =
      startWaterSource === 'today' ? todayWater : Math.max(plantAvailableFraction(gwetNear(series, s.idx), scale) * sc.pawcMm, fallowStoredMm(series, s.idx, sc.pawcMm))
    return { year: s.year, startWater, r: simulateYear(series, s.idx, crop, sc, startWater) }
  })
  const years: YearRun[] = sims.map(({ year, startWater, r }) => {
    const y = r.yieldTHa * rotation.yieldMult * factor
    const profitPerHa = y * price - costPerHa - irrigationPerHa
    return {
      sowYear: year,
      matured: r.days !== null,
      days: r.days,
      rainMm: r.rain,
      startWaterMm: startWater,
      heatDays: r.heatDays,
      frostDays: r.frostDays,
      failure: r.failure,
      solarMj: r.solar,
      waterRatio: r.waterRatio,
      waterLimitedTHa: r.waterLimitedTHa,
      radiationLimitedTHa: r.radiationLimitedTHa,
      stressFactor: r.stressFactor,
      yieldTHa: y,
      profitPerHa,
      profit: profitPerHa * sc.areaHa,
    }
  })

  const matured = sims.filter((s) => s.r.days !== null)
  const daysToHarvest = matured.length ? Math.round(median(matured.map((s) => s.r.days!))) : null
  const phaseDays =
    daysToHarvest !== null
      ? (() => {
          const fs = Math.round(median(matured.map((s) => s.r.floweringStartDay)))
          const fe = Math.round(median(matured.map((s) => s.r.floweringEndDay)))
          return { vegetative: fs, flowering: Math.max(0, fe - fs), ripening: Math.max(0, daysToHarvest - fe) }
        })()
      : null
  const harvestDate = daysToHarvest !== null ? new Date(sowDate.getTime() + daysToHarvest * 86_400_000) : null

  const yieldTHa = mean(years.map((y) => y.yieldTHa))
  const totalTonnes = yieldTHa * sc.areaHa
  const grossRevenue = totalTonnes * price
  const netProfit = grossRevenue - costs
  const roiPct = costs > 0 ? Math.round((netProfit / costs) * 100) : 0
  const lossProbability = years.length ? years.filter((y) => y.profit < 0).length / years.length : 1
  const worstProfit = years.length ? Math.min(...years.map((y) => y.profit)) : -costs
  const offSeason = crop.preferredSeason !== sc.season
  const notSuited = !isRegionallySuited(crop, series.lat, series.lon)

  // Risk-adjusted score (0–100): expected profit per hectare (saturating) minus how often the crop lost money
  // across past seasons. A legume's nitrogen benefit belongs to *next* season's crop, so it is
  // counted there (Previous crop = pulse), not here.
  let score = riskScore(netProfit / sc.areaHa, lossProbability)
  score += rotation.scoreBonus
  if (offSeason) score -= 20
  if (notSuited) score -= 20
  if (!matured.length) score = 5
  score = Math.max(1, Math.min(99, Math.round(score)))

  return {
    crop,
    priceAudPerT: price,
    costAudPerHa: costPerHa,
    years,
    matureShare: years.length ? matured.length / years.length : 0,
    daysToHarvest,
    phaseDays,
    sowDate,
    harvestDate,
    startWaterSource,
    yieldTHa,
    totalTonnes,
    grossRevenue,
    totalCosts: costs,
    netProfit,
    roiPct,
    lossProbability,
    worstProfit,
    avgHeatDays: mean(years.map((y) => y.heatDays)),
    avgFrostDays: mean(years.map((y) => y.frostDays)),
    coldFailShare: years.length ? years.filter((y) => y.failure).length / years.length : 0,
    avgWaterRatio: mean(years.map((y) => y.waterRatio)),
    avgRainMm: mean(years.map((y) => y.rainMm)),
    avgStartWaterMm: mean(years.map((y) => y.startWaterMm)),
    avgWaterLimitedTHa: mean(years.map((y) => y.waterLimitedTHa)),
    avgRadiationLimitedTHa: mean(years.map((y) => y.radiationLimitedTHa)),
    avgStressFactor: mean(years.map((y) => y.stressFactor)),
    waterLimitedShare: years.length ? years.filter((y) => y.waterLimitedTHa < y.radiationLimitedTHa).length / years.length : 0,
    irrigationCost: irrigationPerHa * sc.areaHa,
    rotation,
    offSeason,
    notSuited,
    notRecommended: offSeason || notSuited,
    score,
    abaresFactor: factor,
  }
}

/** Local correction for one crop at this point: √(ABARES state-average yield ÷ this model's yield) over the
 *  seasons both cover, each season replayed with its own weather and soil water at the nominal sowing date. */
export function abaresFactor(series: DailySeries, crop: Crop, pawcMm: number): number {
  const state = grainState(series.lat, series.lon)
  const table = state ? STATE_YIELDS_T_HA[state][crop.id] : undefined
  if (!table) return 1
  const lastYear = Number(series.dates[series.dates.length - 1].slice(0, 4))
  const sc: Scenario = { season: crop.preferredSeason, areaHa: 1, rainAnomalyPct: 0, tempAnomalyC: 0, pawcMm }
  const pairs = evaluateCrop(series, crop, sc, { today: new Date(lastYear + 1, 0, 1), startWater: 'each-year' })
    .years.filter((y) => table[y.sowYear] !== undefined)
    .map((y) => [y.yieldTHa, table[y.sowYear]])
  if (pairs.length < ABARES_FACTOR_MIN_YEARS) return 1
  const model = mean(pairs.map((p) => p[0]))
  const obs = mean(pairs.map((p) => p[1]))
  if (model < 0.05) return 1
  return Math.min(ABARES_FACTOR_MAX, Math.max(ABARES_FACTOR_MIN, Math.sqrt(obs / model)))
}

export interface RankOptions extends EvalOptions {
  /** Apply the local ABARES correction (default true). */
  calibrate?: boolean
}

export function rankCrops(series: DailySeries, crops: Crop[], sc: Scenario, opts: RankOptions = {}): CropResult[] {
  return crops
    .map((c) => evaluateCrop(series, c, sc, { ...opts, yieldFactor: opts.yieldFactor ?? (opts.calibrate === false ? 1 : abaresFactor(series, c, sc.pawcMm)) }))
    // Off-season and regionally unsuited crops always rank below every recommended crop, whatever their economics.
    .sort((a, b) => Number(a.notRecommended) - Number(b.notRecommended) || b.score - a.score || b.netProfit - a.netProfit)
}

export function siteSnapshot(series: DailySeries, sc: Pick<Scenario, 'season' | 'tempAnomalyC'>, today = new Date()): SiteSnapshot {
  const n = series.dates.length
  const last = n - 1
  const bucket = latestBucket(series)
  const scale = soilScale(series)
  let rain90 = 0
  for (let i = Math.max(0, n - 90); i < n; i++) rain90 += series.precip[i]

  const sowDate = nextSowDate(sc.season, today)
  const starts = analogueStarts(series, { month: sowDate.getMonth() + 1, day: sowDate.getDate() }, 150)
  const frost: number[] = []
  const gdd: number[] = []
  const hot: number[] = []
  for (const s of starts) {
    let f = 0
    let g = 0
    let h = 0
    for (let d = 0; d < 150; d++) {
      const tx = series.tmax[s.idx + d] + sc.tempAnomalyC
      const tn = series.tmin[s.idx + d] + sc.tempAnomalyC
      if (tn < FROST_THRESHOLD_C) f++
      if (tx > 32) h++
      g += dailyGdd(tx, tn, 5)
    }
    frost.push(f)
    gdd.push(g)
    hot.push(h)
  }
  // Same 90-day window in each earlier year, for a "vs normal" rainfall comparison.
  const byDate = indexByDate(series)
  const lastDay = new Date(`${series.dates[last]}T00:00:00Z`)
  const past90: number[] = []
  for (let k = 1; k <= 40; k++) {
    const end = byDate.get(isoDate(lastDay.getUTCFullYear() - k, lastDay.getUTCMonth() + 1, lastDay.getUTCDate()))
    if (end === undefined || end < 89) continue
    let r = 0
    for (let i = end - 89; i <= end; i++) r += series.precip[i]
    past90.push(r)
  }
  let solarLatest: number | null = null
  for (let i = last; i >= Math.max(0, last - 10); i--) {
    if (!Number.isNaN(series.solar[i])) {
      solarLatest = series.solar[i]
      break
    }
  }
  return {
    latestDate: series.dates[last],
    bucketFraction: bucket ? plantAvailableFraction(bucket.value, scale) : null,
    gwetRaw: bucket?.value ?? null,
    bucketDate: bucket?.date ?? null,
    soilDry: scale.dry,
    soilWet: scale.wet,
    rain90Mm: rain90,
    rain90NormalMm: past90.length ? mean(past90) : null,
    tmaxLatest: series.tmax[last],
    tminLatest: series.tmin[last],
    precipLatest: series.precip[last],
    solarLatest,
    seasonFrostDays: mean(frost),
    seasonGdd: mean(gdd),
    seasonHotDays: mean(hot),
    analogueYears: starts.length,
  }
}

export interface MoistureAnomaly {
  date: string
  current: number
  /** Mean GWETROOT for the same ±15-day window of the year across earlier years. */
  normal: number
  anomaly: number
  years: number
}

/** Soil moisture anomaly: latest root-zone wetness minus its average for this time of year. */
export function soilMoistureAnomaly(series: DailySeries, windowDays = 15): MoistureAnomaly | null {
  const latest = latestBucket(series)
  if (!latest) return null
  const ref = new Date(`${latest.date}T00:00:00Z`)
  const refYear = ref.getUTCFullYear()
  const vals: number[] = []
  const years = new Set<number>()
  series.dates.forEach((d, i) => {
    const v = series.gwet[i]
    if (Number.isNaN(v)) return
    const t = new Date(`${d}T00:00:00Z`)
    const y = t.getUTCFullYear()
    if (y >= refYear) return
    const anchor = Date.UTC(y, ref.getUTCMonth(), ref.getUTCDate())
    if (Math.abs(t.getTime() - anchor) <= windowDays * 86_400_000) {
      vals.push(v)
      years.add(y)
    }
  })
  if (!vals.length) return null
  const normal = mean(vals)
  return { date: latest.date, current: latest.value, normal, anomaly: latest.value - normal, years: years.size }
}
