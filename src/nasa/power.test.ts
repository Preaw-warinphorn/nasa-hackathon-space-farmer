import { describe, expect, it } from 'vitest'
import type { DailySeries } from './power'
import { GWET_SPLICE_DROP, spliceGwet } from './power'

function series(gwet: number[]): DailySeries {
  const start = Date.UTC(2026, 0, 1)
  const dates = gwet.map((_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10))
  const z = gwet.map(() => 0)
  return { lat: -30, lon: 150, elevationM: null, dates, tmax: z, tmin: z, precip: z, gwet, solar: z, fetchedAt: 0, requestUrl: '' }
}

describe('GWETROOT source splice', () => {
  it('shifts readings after an overnight fall no real soil makes', () => {
    const g = [...Array(100).fill(0.55), ...Array(30).fill(0.45)]
    const out = spliceGwet(series(g))
    expect(out.gwetAdjustment?.fromDate).toBe(out.dates[100])
    expect(out.gwetAdjustment?.offset).toBeCloseTo(0.1, 6)
    expect(out.gwet.at(-1)).toBeCloseTo(0.55, 6)
    expect(out.gwet[0]).toBe(0.55)
  })

  it('leaves normal slow drying alone', () => {
    const g = Array.from({ length: 200 }, (_, i) => 0.6 - i * (GWET_SPLICE_DROP / 3))
    const out = spliceGwet(series(g))
    expect(out.gwetAdjustment).toBeUndefined()
    expect(out.gwet).toEqual(g)
  })

  it('ignores a rise (rain wets soil fast) and skips missing days', () => {
    const g = [...Array(50).fill(0.4), NaN, ...Array(50).fill(0.6)]
    expect(spliceGwet(series(g)).gwetAdjustment).toBeUndefined()
  })
})
