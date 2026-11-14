import { describe, expect, it } from 'vitest'
import type { Crop } from '../data/crops'
import { CROPS } from '../data/crops'
import type { DailySeries } from '../nasa/power'
import { parsePowerJson } from '../nasa/power'
import { analogueStarts, dailyGdd, defaultSeason, evaluateCrop, latestBucket, nextSowDate, plantAvailableFraction, rankCrops, simulateYear, siteSnapshot, soilMoistureAnomaly, soilScale } from './model'
import { IRRIGATION_AUD_PER_MM_HA, rotationEffect } from '../data/rotation'

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

const testCrop: Crop = {
  ...CROPS[0],
  tBase: 5,
  targetGdd: 1000,
  wueKgHaMm: 15,
  evapLossMm: 110,
  rueGPerMj: 1.2,
  harvestIndex: 0.4,
  maxYieldTHa: 8,
  heatThresholdC: 32,
  preferredSeason: 'winter',
}
const baseScenario = { season: 'winter' as const, areaHa: 100, rainAnomalyPct: 0, tempAnomalyC: 0, pawcMm: 200 }
const MAY15 = { month: 5, day: 15 }
/** A date that makes the winter sowing date the nominal 15 May, far enough away to replay each year's own soil water. */
const JAN = new Date(2026, 0, 1)

describe('thermal time', () => {
  it('computes GDD with the mean-temperature formula and floors at zero', () => {
    expect(dailyGdd(25, 15, 5)).toBe(15)
    expect(dailyGdd(4, -2, 5)).toBe(0)
  })

  it('reaches maturity after targetGdd / dailyGdd days', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    expect(simulateYear(s, 0, testCrop, baseScenario, 100).days).toBe(100) // 10 °C·d per day
  })

  it('warming shortens the season', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    expect(simulateYear(s, 0, testCrop, { ...baseScenario, tempAnomalyC: 2.5 }, 100).days).toBe(80)
  })

  it('never matures when too cold, and then yields nothing', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 8, tmin: 0, precip: 2 })
    const r = simulateYear(s, 0, testCrop, baseScenario, 100)
    expect(r.days).toBeNull()
    expect(r.yieldTHa).toBe(0)
  })
})

describe('yield limits', () => {
  it('water-limited yield follows French–Schultz: WUE × (soil water + rain − E)', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 1 }) // 100 days × 1 mm
    const r = simulateYear(s, 0, testCrop, baseScenario, 60)
    expect(r.waterLimitedTHa).toBeCloseTo((15 * (60 + 100 - 110)) / 1000, 6)
    expect(r.yieldTHa).toBeCloseTo(r.waterLimitedTHa, 6) // water is the binding limit here
  })

  it('yields nothing when water never exceeds the evaporation loss', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 0.5 })
    expect(simulateYear(s, 0, testCrop, baseScenario, 0).yieldTHa).toBe(0)
  })

  it('sunlight caps yield when water is plentiful', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 10 }) // solar 20 MJ/day
    const r = simulateYear(s, 0, testCrop, baseScenario, 200)
    expect(r.radiationLimitedTHa).toBeCloseTo(100 * 20 * 0.5 * 1.2 * 0.4 * 0.01, 6) // 4.8 t/ha
    expect(r.yieldTHa).toBeCloseTo(r.radiationLimitedTHa, 6)
  })

  it('counts heat days only during flowering/grain fill', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 35, tmin: 5, precip: 2 }) // 15 °C·d/day → 67 days
    const r = simulateYear(s, 0, testCrop, baseScenario, 100)
    expect(r.days).toBe(67)
    expect(r.heatDays).toBeGreaterThan(25)
    expect(r.heatDays).toBeLessThan(35)
  })

  it('rain anomaly scales in-season rainfall and cuts water-limited yield', () => {
    const s = makeSeries({ from: '2020-01-01', days: 800, tmax: 20, tmin: 10, precip: 2 })
    const dry = simulateYear(s, 0, testCrop, { ...baseScenario, rainAnomalyPct: -50 }, 0)
    const normal = simulateYear(s, 0, testCrop, baseScenario, 0)
    expect(dry.rain).toBeCloseTo(normal.rain / 2)
    expect(dry.yieldTHa).toBeLessThan(normal.yieldTHa)
  })
})

describe('soil water at sowing', () => {
  it('rescales GWETROOT between the site’s dry and wet ends', () => {
    expect(plantAvailableFraction(0.5, { dry: 0.4, wet: 0.6 })).toBeCloseTo(0.5)
    expect(plantAvailableFraction(0.35, { dry: 0.4, wet: 0.6 })).toBe(0)
    expect(plantAvailableFraction(0.7, { dry: 0.4, wet: 0.6 })).toBe(1)
  })

  it('starts each past season from that year’s own soil water when sowing is far off', () => {
    const s = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 20, tmin: 10, precip: 2, gwet: 0.5 })
    // Make 2016 bone dry and 2017 wet at sowing; everything else mid.
    for (let i = 0; i < s.dates.length; i++) {
      if (s.dates[i].startsWith('2016-05')) s.gwet[i] = 0.2
      if (s.dates[i].startsWith('2017-05')) s.gwet[i] = 0.8
    }
    const r = evaluateCrop(s, testCrop, baseScenario, { today: JAN })
    expect(r.startWaterSource).toBe('each-year')
    const y = Object.fromEntries(r.years.map((x) => [x.sowYear, x]))
    expect(y[2016].startWaterMm).toBe(0)
    expect(y[2017].startWaterMm).toBe(200)
    expect(y[2016].yieldTHa).toBeLessThan(y[2017].yieldTHa)
  })

  it('uses today’s measured soil water for every replay when sowing is imminent', () => {
    const s = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 20, tmin: 10, precip: 2, gwet: 0.5 })
    const today = new Date(`${s.dates.at(-1)}T00:00:00`)
    const r = evaluateCrop(s, { ...testCrop, preferredSeason: 'spring' }, { ...baseScenario, season: 'spring' }, { today: new Date(today.getFullYear(), 9, 20) })
    expect(r.startWaterSource).toBe('today')
    expect(new Set(r.years.map((y) => y.startWaterMm)).size).toBe(1)
  })

  it('treats a flat record as mid-range rather than dividing by zero', () => {
    const s = makeSeries({ from: '2020-01-01', days: 500, tmax: 20, tmin: 10, precip: 1, gwet: 0.5 })
    expect(soilScale(s)).toEqual({ dry: 0.1, wet: 0.9 })
  })
})

describe('sowing windows', () => {
  it('sows today inside a window, otherwise on the next nominal date', () => {
    expect(nextSowDate('spring', new Date(2026, 10, 14)).toDateString()).toBe(new Date(2026, 10, 14).toDateString())
    expect(nextSowDate('winter', new Date(2026, 10, 14)).toDateString()).toBe(new Date(2027, 4, 15).toDateString())
    expect(nextSowDate('winter', new Date(2026, 4, 20)).toDateString()).toBe(new Date(2026, 4, 20).toDateString())
    expect(nextSowDate('spring', new Date(2026, 3, 1)).toDateString()).toBe(new Date(2026, 9, 15).toDateString())
  })

  it('defaults to the season that comes first', () => {
    expect(defaultSeason(new Date(2026, 10, 14))).toBe('spring')
    expect(defaultSeason(new Date(2026, 1, 1))).toBe('winter')
    expect(defaultSeason(new Date(2026, 7, 1))).toBe('spring')
  })
})

describe('analogue years & economics', () => {
  const s = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 20, tmin: 10, precip: 2, gwet: 0.4 })

  it('only uses years whose full season window is in the record', () => {
    const starts = analogueStarts(s, MAY15)
    expect(starts[0].year).toBe(2015)
    expect(starts.at(-1)!.year).toBeLessThanOrEqual(2020)
    expect(s.dates[starts[0].idx]).toBe('2015-05-15')
  })

  it('computes revenue, cost, margin and ROI per hectare consistently', () => {
    const r = evaluateCrop(s, testCrop, baseScenario, { today: JAN })
    expect(r.totalCosts).toBe(testCrop.costAudPerHa * 100)
    expect(r.grossRevenue).toBeCloseTo(r.yieldTHa * 100 * testCrop.priceAudPerT)
    expect(r.netProfit).toBeCloseTo(r.grossRevenue - r.totalCosts)
    expect(r.daysToHarvest).toBe(100)
    expect(r.harvestDate?.toDateString()).toBe(new Date(2026, 4, 15 + 100).toDateString())
  })

  it('applies price and cost overrides', () => {
    const r = evaluateCrop(s, testCrop, { ...baseScenario, economics: { [testCrop.id]: { priceAudPerT: 500, costAudPerHa: 300 } } }, { today: JAN })
    expect(r.priceAudPerT).toBe(500)
    expect(r.totalCosts).toBe(300 * 100)
  })

  it('ranks in-season crops first, each group by descending score', () => {
    for (const season of ['winter', 'spring'] as const) {
      const ranked = rankCrops(s, CROPS, { ...baseScenario, season }, { today: JAN })
      const firstOff = ranked.findIndex((r) => r.offSeason)
      expect(firstOff).toBeGreaterThan(0)
      expect(ranked.slice(firstOff).every((r) => r.offSeason)).toBe(true)
      for (let i = 1; i < ranked.length; i++) {
        if (ranked[i - 1].offSeason === ranked[i].offSeason) expect(ranked[i - 1].score).toBeGreaterThanOrEqual(ranked[i].score)
      }
    }
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
    expect(latestBucket(s)).toEqual({ value: 0.42, date: s.dates[490], index: 490 })
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

describe('irrigation and rotation', () => {
  const dry = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 22, tmin: 10, precip: 1, gwet: 0.2 })

  it('irrigation adds water and its cost', () => {
    const base = evaluateCrop(dry, testCrop, baseScenario, { today: JAN })
    const irr = evaluateCrop(dry, testCrop, { ...baseScenario, irrigationMm: 100 }, { today: JAN })
    expect(irr.yieldTHa).toBeGreaterThan(base.yieldTHa)
    expect(irr.irrigationCost).toBeCloseTo(100 * IRRIGATION_AUD_PER_MM_HA * baseScenario.areaHa, 6)
    expect(irr.totalCosts - base.totalCosts).toBeCloseTo(irr.irrigationCost, 6)
  })

  it('applies rotation yield multipliers, fertiliser savings and score bonuses', () => {
    const wheat = CROPS.find((c) => c.id === 'wheat')!
    const wet = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 22, tmin: 10, precip: 2, gwet: 0.5 })
    const base = evaluateCrop(wet, wheat, baseScenario, { today: JAN })
    const afterPulse = evaluateCrop(wet, wheat, { ...baseScenario, previousCrop: 'pulse' }, { today: JAN })
    const afterCereal = evaluateCrop(wet, wheat, { ...baseScenario, previousCrop: 'cereal' }, { today: JAN })
    expect(base.yieldTHa).toBeGreaterThan(0)
    expect(afterPulse.yieldTHa).toBeCloseTo(base.yieldTHa * 1.15, 6)
    expect(afterPulse.totalCosts).toBeCloseTo(base.totalCosts - 90 * baseScenario.areaHa, 6)
    expect(afterCereal.yieldTHa).toBeCloseTo(base.yieldTHa * 0.85, 6)
    expect(afterCereal.rotation.tone).toBe('bad')
    expect(rotationEffect('none', 'wheat').yieldMult).toBe(1)
    expect(rotationEffect('canola', 'canola').yieldMult).toBe(0.8)
  })
})

describe('site snapshot', () => {
  it('reports a 90-day rainfall normal from earlier years', () => {
    const s = makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 35, tmin: 10, precip: 2 })
    const snap = siteSnapshot(s, { season: 'winter', tempAnomalyC: 0 }, JAN)
    expect(snap.rain90Mm).toBeCloseTo(180, 6)
    expect(snap.rain90NormalMm).toBeCloseTo(180, 6)
    expect(snap.seasonHotDays).toBe(150)
  })
})

describe('regional suitability', () => {
  it('ranks dryland summer crops last outside the northern summer-rainfall zone', () => {
    const south = { ...makeSeries({ from: '2015-01-01', days: 365 * 6, tmax: 26, tmin: 14, precip: 3, gwet: 0.5 }), lat: -36.7, lon: 142.2 }
    const north = { ...south, lat: -29.5, lon: 149.8 }
    const sc = { ...baseScenario, season: 'spring' as const }
    const s = rankCrops(south, CROPS, sc, { today: JAN })
    expect(s.filter((r) => r.crop.summerRainfallZoneOnly).every((r) => r.notSuited && r.notRecommended)).toBe(true)
    expect(s.slice(-2).every((r) => r.crop.summerRainfallZoneOnly)).toBe(false) // winter crops are off-season here too
    const n = rankCrops(north, CROPS, sc, { today: JAN })
    expect(n.filter((r) => r.crop.summerRainfallZoneOnly).every((r) => !r.notSuited && !r.notRecommended)).toBe(true)
    expect(n[0].crop.summerRainfallZoneOnly).toBe(true)
  })
})
