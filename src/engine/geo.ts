// Small geodesy helpers for paddock boundaries. Pure functions.

export type LatLon = [number, number]

const EARTH_RADIUS_M = 6378137
const ACRES_PER_M2 = 0.000247105

/** Area of a lat/lon polygon on the sphere, in acres (spherical-excess approximation,
 *  same method as Leaflet.draw's geodesicArea). Accurate to well under 1 % at paddock scale. */
export function polygonAreaAcres(points: LatLon[]): number {
  if (points.length < 3) return 0
  const rad = Math.PI / 180
  let area = 0
  for (let i = 0; i < points.length; i++) {
    const [lat1, lon1] = points[i]
    const [lat2, lon2] = points[(i + 1) % points.length]
    area += (lon2 - lon1) * rad * (2 + Math.sin(lat1 * rad) + Math.sin(lat2 * rad))
  }
  return Math.abs((area * EARTH_RADIUS_M * EARTH_RADIUS_M) / 2) * ACRES_PER_M2
}

/** Vertex average — good enough as a pin location for a convex-ish paddock. */
export function polygonCenter(points: LatLon[]): LatLon {
  const n = points.length
  return [points.reduce((a, p) => a + p[0], 0) / n, points.reduce((a, p) => a + p[1], 0) / n]
}

/** Drop consecutive near-duplicate vertices (a double-click to finish adds two clicks at one spot). */
export function dedupePoints(points: LatLon[], eps = 1e-6): LatLon[] {
  return points.filter((p, i) => i === 0 || Math.abs(p[0] - points[i - 1][0]) > eps || Math.abs(p[1] - points[i - 1][1]) > eps)
}
