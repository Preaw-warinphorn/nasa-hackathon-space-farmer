// AcreCast agronomic & economic engine. Pure functions — no DOM, no network.
//
// Approach: take today's measured root-zone soil moisture (NASA POWER GWETROOT) as the starting
// water bucket, then replay the coming season against every past year of NASA POWER daily weather
// at this location (an analogue-year ensemble). Each replay accumulates growing degree days to find
// harvest maturity, counts heat/frost stress during flowering & grain fill, and runs a simple water
// balance. Results across years give an expected return *and* a downside risk.

import type { Crop, Season } from '../data/crops'
import type { PreviousCrop, RotationEffect } from '../data/rotation'
import { HA_PER_ACRE, IRRIGATION_AUD_PER_MM_HA, rotationEffect } from '../data/rotation'
import type { DailySeries } from '../nasa/power'

export const MAX_SEASON_DAYS = 240
const HISTORY_SPAN_YEARS = 40
export const FROST_THRESHOLD_C = 1 // 2 m air temperature at which ground frost becomes likely
/** Share of in-season rainfall that becomes plant-available (rest lost to runoff/evaporation). */
export const RAIN_EFFICIENCY = 0.8
export const FLOWERING_START = 0.4
export const FLOWERING_END = 0.85
const SOW_DAY: Record<Season, { month: number; day: number }> = {
  winter: { month: 5, day: 15 },
  spring: { month: 10, day: 15 },
}

export interface Scenario {
  season: Season
  acres: number
  rainAnomalyPct: number
  tempAnomalyC: number
  pawcMm: number
  /** Supplemental irrigation applied over the season (mm). */
  irrigationMm?: number
  /** Last season's crop on this paddock (rotation effects). */
  previousCrop?: PreviousCrop
}

export interface YearRun {
  sowYear: number
  matured: boolean
  days: number | null
  rainMm: number
  heatDays: number
  frostDays: number
  waterRatio: number
  /** Yield multiplier from water supply alone. */
  waterFactor: number
  /** Yield multiplier from heat & frost damage at flowering. */
  stressFactor: number
  /** Combined yield multiplier incl. rotation (0 if the crop didn't mature). */
  yieldFactor: number
  profit: number
}

export interface CropResult {
  crop: Crop
  years: YearRun[]
  matureShare: number
  daysToHarvest: number | null
  phaseDays: { vegetative: number; flowering: number; ripening: number } | null
  sowDate: Date
  harvestDate: Date | null
  yieldAc: number
  totalTonnes: number
  grossRevenue: number
  totalCosts: number
  netProfit: number
  roiPct: number
  lossProbability: number
  worstProfit: number
  avgHeatDays: number
  avgFrostDays: number
  avgWaterRatio: number
  avgRainMm: number
  avgWaterFactor: number
  avgStressFactor: number
  irrigationCost: number
  rotation: RotationEffect
  offSeason: boolean
  score: number
}

export interface SiteSnapshot {
  latestDate: string
  bucketFraction: number | null
  bucketDate: string | null
  rain90Mm: number
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
  /** Mean rainfall over the same 90-day window (ending on the same calendar day) in earlier years. */
  rain90NormalMm: number | null
  analogueYears: number
}

function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

const mean = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0)

function indexByDate(series: DailySeries): Map<string, number> {
  const m = new Map<string, number>()
  series.dates.forEach((d, i) => m.set(d, i))
  return m
}

function isoDate(y: number, month: number, day: number) {
  return `${y}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Sowing-day indices for every past year whose full season window is covered by the data. */
export function analogueStarts(series: DailySeries, season: Season, windowDays = MAX_SEASON_DAYS): { year: number; idx: number }[] {
  const idx = indexByDate(series)
  const { month, day } = SOW_DAY[season]
  const first = Number(series.dates[0].slice(0, 4))
  const lastYear = Number(series.dates[series.dates.length - 1].slice(0, 4))
  const out: { year: number; idx: number }[] = []
  for (let y = first; y <= lastYear; y++) {
    const i = idx.get(isoDate(y, month, day))
    if (i !== undefined && i + windowDays < series.dates.length) out.push({ year: y, idx: i })
  }
  return out
}

/** Next upcoming sowing date for the season (today counts as upcoming). */
export function nextSowDate(season: Season, today = new Date()): Date {
  const { month, day } = SOW_DAY[season]
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const d = new Date(today.getFullYear(), month - 1, day)
  if (d < t) d.setFullYear(d.getFullYear() + 1)
  return d
}

/** Latest valid root-zone wetness value (GWETROOT is published with a short lag). */
export function latestBucket(series: DailySeries): { value: number; date: string } | null {
  for (let i = series.gwet.length - 1; i >= 0; i--) {
    if (!Number.isNaN(series.gwet[i])) return { value: series.gwet[i], date: series.dates[i] }
  }
  return null
}

export function dailyGdd(tmax: number, tmin: number, tBase: number): number {
  return Math.max(0, (tmax + tmin) / 2 - tBase)
}

/** Share of crop water demand lost to soil evaporation before any grain is set
 *  (cf. the 110 mm evaporation term in French–Schultz water-limited yield). */
export const WATER_FAILURE_RATIO = 0.2

/** Yield multiplier from water supply/demand. Falls to zero when water runs out: below
 *  WATER_FAILURE_RATIO the crop sets no grain; above it yield rises to 1 at full demand, with a
 *  curve that drops faster for drought-sensitive crops. Surplus water adds at most 15 %. */
export function waterYieldFactor(waterRatio: number, droughtTolerance: number): number {
  if (waterRatio >= 1) return Math.min(1.15, 1 + (waterRatio - 1) * 0.2)
  const usable = Math.max(0, (waterRatio - WATER_FAILURE_RATIO) / (1 - WATER_FAILURE_RATIO))
  return usable ** (0.6 + 1.6 * (1 - droughtTolerance))
}

/** Replay one season for one crop starting at series index `start`. */
export function simulateYear(series: DailySeries, start: number, crop: Crop, sc: Scenario, storedWaterMm: number) {
  let gdd = 0
  let rain = 0
  let heatDays = 0
  let frostDays = 0
  let days: number | null = null
  let floweringStartDay = 0
  let floweringEndDay = 0
  const rainMult = 1 + sc.rainAnomalyPct / 100
  for (let d = 0; d < MAX_SEASON_DAYS && start + d < series.dates.length; d++) {
    const i = start + d
    const tx = series.tmax[i] + sc.tempAnomalyC
    const tn = series.tmin[i] + sc.tempAnomalyC
    gdd += dailyGdd(tx, tn, crop.tBase)
    rain += series.precip[i] * rainMult
    const frac = gdd / crop.targetGdd
    if (frac >= FLOWERING_START && !floweringStartDay) floweringStartDay = d + 1
    if (frac >= FLOWERING_START && frac < FLOWERING_END) {
      if (tx > crop.heatThresholdC) heatDays++
      if (tn < FROST_THRESHOLD_C) frostDays++
    }
    if (frac >= FLOWERING_END && !floweringEndDay) floweringEndDay = d + 1
    if (gdd >= crop.targetGdd) {
      days = d + 1
      break
    }
  }
  const waterRatio = (storedWaterMm + rain * RAIN_EFFICIENCY + (sc.irrigationMm ?? 0)) / crop.waterDemandMm
  const waterFactor = waterYieldFactor(waterRatio, crop.droughtTolerance)
  const stressFactor = Math.max(0.25, 1 - heatDays * crop.heatLossPerDay - frostDays * crop.frostLossPerDay)
  const yieldFactor = days !== null ? waterFactor * stressFactor : 0
  return { days, gdd, rain, heatDays, frostDays, waterRatio, waterFactor, stressFactor, yieldFactor, floweringStartDay, floweringEndDay }
}

export function evaluateCrop(series: DailySeries, crop: Crop, sc: Scenario, bucketFraction: number, today = new Date()): CropResult {
  const starts = analogueStarts(series, sc.season)
  const stored = bucketFraction * sc.pawcMm
  const rotation = rotationEffect(sc.previousCrop ?? 'none', crop.id)
  const irrigationCost = (sc.irrigationMm ?? 0) * IRRIGATION_AUD_PER_MM_HA * HA_PER_ACRE * sc.acres
  const costs = Math.max(80, crop.costAudPerAc - rotation.costSavingAudPerAc) * sc.acres + irrigationCost
  const sims = starts.map((s) => ({ year: s.year, r: simulateYear(series, s.idx, crop, sc, stored) }))
  const years: YearRun[] = sims.map(({ year, r }) => ({
    sowYear: year,
    matured: r.days !== null,
    days: r.days,
    rainMm: r.rain,
    heatDays: r.heatDays,
    frostDays: r.frostDays,
    waterRatio: r.waterRatio,
    waterFactor: r.waterFactor,
    stressFactor: r.stressFactor,
    yieldFactor: r.yieldFactor * rotation.yieldMult,
    profit: crop.baseYieldAc * r.yieldFactor * rotation.yieldMult * sc.acres * crop.priceAudPerT - costs,
  }))

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

  const sowDate = nextSowDate(sc.season, today)
  const harvestDate = daysToHarvest !== null ? new Date(sowDate.getTime() + daysToHarvest * 86_400_000) : null

  const yieldAc = crop.baseYieldAc * mean(years.map((y) => y.yieldFactor))
  const totalTonnes = yieldAc * sc.acres
  const grossRevenue = totalTonnes * crop.priceAudPerT
  const netProfit = grossRevenue - costs
  const roiPct = costs > 0 ? Math.round((netProfit / costs) * 100) : 0
  const lossProbability = years.length ? years.filter((y) => y.profit < 0).length / years.length : 1
  const worstProfit = years.length ? Math.min(...years.map((y) => y.profit)) : -costs
  const offSeason = crop.preferredSeason !== sc.season

  // Risk-adjusted investment score (0–100): expected ROI, minus how often the crop lost money
  // across analogue years, plus a rotation credit for nitrogen-fixing legumes.
  // ROI enters through tanh so very high-margin crops don't all saturate at the top.
  let score = 40 + 35 * Math.tanh(roiPct / 150) - 35 * lossProbability
  if (crop.nitrogenKgHa > 0) score += 8
  score += rotation.scoreBonus
  if (offSeason) score -= 20
  if (!matured.length) score = 5
  score = Math.max(1, Math.min(99, Math.round(score)))

  return {
    crop,
    years,
    matureShare: years.length ? matured.length / years.length : 0,
    daysToHarvest,
    phaseDays,
    sowDate,
    harvestDate,
    yieldAc,
    totalTonnes,
    grossRevenue,
    totalCosts: costs,
    netProfit,
    roiPct,
    lossProbability,
    worstProfit,
    avgHeatDays: mean(years.map((y) => y.heatDays)),
    avgFrostDays: mean(years.map((y) => y.frostDays)),
    avgWaterRatio: mean(years.map((y) => y.waterRatio)),
    avgRainMm: mean(years.map((y) => y.rainMm)),
    avgWaterFactor: mean(years.map((y) => y.waterFactor)),
    avgStressFactor: mean(years.map((y) => y.stressFactor)),
    irrigationCost,
    rotation,
    offSeason,
    score,
  }
}

export function rankCrops(series: DailySeries, crops: Crop[], sc: Scenario, bucketFraction: number, today = new Date()): CropResult[] {
  return crops
    .map((c) => evaluateCrop(series, c, sc, bucketFraction, today))
    // Off-season crops always rank below every in-season crop, whatever their economics.
    .sort((a, b) => Number(a.offSeason) - Number(b.offSeason) || b.score - a.score || b.netProfit - a.netProfit)
}

export function siteSnapshot(series: DailySeries, sc: Pick<Scenario, 'season' | 'tempAnomalyC'>): SiteSnapshot {
  const n = series.dates.length
  const last = n - 1
  const bucket = latestBucket(series)
  let rain90 = 0
  for (let i = Math.max(0, n - 90); i < n; i++) rain90 += series.precip[i]

  const starts = analogueStarts(series, sc.season, 150)
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
  for (let k = 1; k <= HISTORY_SPAN_YEARS; k++) {
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
    bucketFraction: bucket?.value ?? null,
    bucketDate: bucket?.date ?? null,
    rain90Mm: rain90,
    tmaxLatest: series.tmax[last],
    tminLatest: series.tmin[last],
    precipLatest: series.precip[last],
    solarLatest,
    seasonFrostDays: mean(frost),
    seasonGdd: mean(gdd),
    seasonHotDays: mean(hot),
    rain90NormalMm: past90.length ? mean(past90) : null,
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
    // Same calendar date in year y, compared within ±windowDays.
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
