import { describe, expect, it } from 'vitest'
import { dedupePoints, polygonAreaAcres, polygonCenter } from './geo'

describe('paddock geometry', () => {
  it('measures a ~1 km square near Moree as ~247 acres', () => {
    const lat = -29.46
    const dLat = 1000 / 111_320
    const dLon = 1000 / (111_320 * Math.cos((lat * Math.PI) / 180))
    const sq: [number, number][] = [
      [lat, 149.84],
      [lat, 149.84 + dLon],
      [lat + dLat, 149.84 + dLon],
      [lat + dLat, 149.84],
    ]
    expect(polygonAreaAcres(sq)).toBeGreaterThan(245)
    expect(polygonAreaAcres(sq)).toBeLessThan(249)
    expect(polygonCenter(sq)[0]).toBeCloseTo(lat + dLat / 2, 9)
  })

  it('needs three points and drops double-click duplicates', () => {
    expect(polygonAreaAcres([[0, 0], [1, 1]])).toBe(0)
    expect(dedupePoints([[1, 1], [1, 1], [2, 2], [2, 2]])).toEqual([[1, 1], [2, 2]])
  })
})
