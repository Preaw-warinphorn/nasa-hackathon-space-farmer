import { describe, expect, it } from 'vitest'
import type { Crop } from '../data/crops'
import { CROPS } from '../data/crops'
import type { DailySeries } from '../nasa/power'
import { parsePowerJson } from '../nasa/power'
import { analogueStarts, dailyGdd, evaluateCrop, latestBucket, nextSowDate, rankCrops, simulateYear, soilMoistureAnomaly, waterYieldFactor } from './model'

/** Build a synthetic contiguous daily series with constant weather. */
function makeSeries(opts: { from: string; days: number; tmax: number; tmin: number; precip: number; gwet?: number }): DailySeries {
  const start = new Date(`${opts.from}T00:00:00Z`).getTime()
  const dates: string[] = []
  for (let i = 0; i < opts.days; i++) dates.push(new Date(start + i * 86_400_000).toISOString().slice(0, 10))
  const fill = (v: number) => dates.map(() => v)
  return {
    lat: -30,
    lon: 150,
    elevationM: null,
    dates,
    tmax: fill(opts.tmax),
    tmin: fill(opts.tmin),
    precip: fill(opts.precip),
    gwet: fill(opts.gwet ?? 0.5),
    solar: fill(20),
    fetchedAt: 0,
    requestUrl: '',
  }
}

const testCrop: Crop = { ...CROPS[0], tBase: 5, targetGdd: 1000, waterDemandMm: 200, heatThresholdC: 32, preferredSeason: 'winter' }
const baseScenario = { season: 'winter' as const, acres: 100, rainAnomalyPct: 0, tempAnomalyC: 0, pawcMm: 200 }

describe('thermal time', () => {
  it('computes GDD with the mean-temperature formula and floors at zero', () => {
    expect(dailyGdd(25, 15, 5)).toBe(15)
    expect(dailyGdd(4, -2, 5)).toBe(0)
  })

  it('reaches maturity after targetGdd / dailyGdd days', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    const r = simulateYear(s, 0, testCrop, baseScenario, 100)
    expect(r.days).toBe(100) // 10 °C·d per day → 1000 / 10
  })

  it('warming shortens the season', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    const r = simulateYear(s, 0, testCrop, { ...baseScenario, tempAnomalyC: 2.5 }, 100)
    expect(r.days).toBe(80) // 12.5 °C·d per day
  })

  it('never matures when too cold', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 8, tmin: 0, precip: 2 })
    const r = simulateYear(s, 0, testCrop, baseScenario, 100)
    expect(r.days).toBeNull()
    expect(r.yieldFactor).toBe(0)
  })
})

describe('stress', () => {
  it('drives yield to zero as water runs out', () => {
    for (const tol of [0.4, 0.65, 0.9]) {
      expect(waterYieldFactor(0, tol)).toBe(0)
      expect(waterYieldFactor(0.2, tol)).toBe(0)
      expect(waterYieldFactor(0.3, tol)).toBeLessThan(0.3)
      expect(waterYieldFactor(1, tol)).toBe(1)
    }
  })

  it('penalises water deficit more for drought-sensitive crops', () => {
    expect(waterYieldFactor(0.6, 0.85)).toBeGreaterThan(waterYieldFactor(0.6, 0.4))
    expect(waterYieldFactor(1.5, 0.5)).toBeLessThanOrEqual(1.15)
  })

  it('counts heat days only during flowering/grain fill', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 35, tmin: 5, precip: 2 }) // 15 °C·d/day → 67 days
    const r = simulateYear(s, 0, testCrop, baseScenario, 100)
    expect(r.days).toBe(67)
    // flowering window covers GDD fractions 0.4–0.85 ≈ days 27–56
    expect(r.heatDays).toBeGreaterThan(25)
    expect(r.heatDays).toBeLessThan(35)
  })

  it('rain anomaly scales in-season rainfall', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    const dry = simulateYear(s, 0, testCrop, { ...baseScenario, rainAnomalyPct: -50 }, 0)
    const normal = simulateYear(s, 0, testCrop, baseScenario, 0)
    expect(dry.rain).toBeCloseTo(normal.rain / 2)
    expect(dry.yieldFactor).toBeLessThan(normal.yieldFactor)
  })
})

describe('analogue years & economics', () => {
  const s = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 20, tmin: 10, precip: 2, gwet: 0.4 })

  it('only uses years whose full season window is in the record', () => {
    const years = analogueStarts(s, 'winter').map((a) => a.year)
    expect(years[0]).toBe(2015)
    expect(years.at(-1)).toBeLessThanOrEqual(2020)
    expect(s.dates[analogueStarts(s, 'winter')[0].idx]).toBe('2015-05-15')
  })

  it('computes revenue, cost, profit and ROI consistently', () => {
    const r = evaluateCrop(s, testCrop, baseScenario, 0.4, new Date(2026, 0, 1))
    expect(r.totalCosts).toBe(testCrop.costAudPerAc * 100)
    expect(r.grossRevenue).toBeCloseTo(r.yieldAc * 100 * testCrop.priceAudPerT)
    expect(r.netProfit).toBeCloseTo(r.grossRevenue - r.totalCosts)
    expect(r.daysToHarvest).toBe(100)
    expect(r.harvestDate?.toDateString()).toBe(new Date(2026, 4, 15 + 100).toDateString())
  })

  it('ranks in-season crops first, each group by descending score', () => {
    for (const season of ['winter', 'spring'] as const) {
      const ranked = rankCrops(s, CROPS, { ...baseScenario, season }, 0.4)
      const firstOff = ranked.findIndex((r) => r.offSeason)
      expect(firstOff).toBeGreaterThan(0)
      expect(ranked.slice(firstOff).every((r) => r.offSeason)).toBe(true)
      for (let i = 1; i < ranked.length; i++) {
        if (ranked[i - 1].offSeason === ranked[i].offSeason) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
      }
    }
  })

  it('picks the next upcoming sowing date', () => {
    expect(nextSowDate('winter', new Date(2026, 10, 14)).toDateString()).toBe(new Date(2027, 4, 15).toDateString())
    expect(nextSowDate('spring', new Date(2026, 3, 1)).toDateString()).toBe(new Date(2026, 9, 15).toDateString())
  })
})

describe('NASA POWER parsing', () => {
  it('converts fill values, forward-fills temperature gaps and trims unpublished days', () => {
    const days = Array.from({ length: 500 }, (_, i) => new Date(Date.UTC(2024, 0, 1 + i)).toISOString().slice(0, 10).replace(/-/g, ''))
    const param = (fn: (i: number) => number) => Object.fromEntries(days.map((d, i) => [d, fn(i)]))
    const json = {
      header: { fill_value: -999 },
      properties: {
        parameter: {
          T2M_MAX: param((i) => (i === 10 ? -999 : i >= 498 ? -999 : 25)),
          T2M_MIN: param(() => 10),
          PRECTOTCORR: param((i) => (i === 3 ? -999 : 1)),
          GWETROOT: param((i) => (i > 490 ? -999 : 0.42)),
          ALLSKY_SFC_SW_DWN: param(() => 20),
        },
      },
    }
    const s = parsePowerJson(json, -30, 150, 'x')
    expect(s.dates.length).toBe(498)
    expect(s.dates[0]).toBe('2024-01-01')
    expect(s.tmax[10]).toBe(25)
    expect(s.precip[3]).toBe(0)
    expect(latestBucket(s)).toEqual({ value: 0.42, date: s.dates[490] })
  })

  it('throws a readable error on API error payloads', () => {
    expect(() => parsePowerJson({ messages: ['Invalid latitude'] }, 0, 0, 'x')).toThrow('Invalid latitude')
  })
})

describe('soil moisture anomaly', () => {
  it('compares the latest wetness with the same time of year in earlier years', () => {
    const s = makeSeries({ from: '2020-01-01', days: 365 * 4 + 100, tmax: 20, tmin: 10, precip: 1, gwet: 0.5 })
    s.gwet[s.gwet.length - 1] = 0.3
    const a = soilMoistureAnomaly(s)!
    expect(a.current).toBe(0.3)
    expect(a.normal).toBeCloseTo(0.5)
    expect(a.anomaly).toBeCloseTo(-0.2)
    expect(a.years).toBe(4)
  })
})
