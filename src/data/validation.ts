// "Model vs reality": ABARES state-average yields used to check the model.
//
// Source: ABARES, Australian Crop Report September 2026 (No. 219), State Data workbook
// (production ÷ area). Season key = sowing year: 2024 means the 2024–25 season
// (winter crops sown autumn 2024, sorghum sown spring 2024). 2022–23 onward are ABARES estimates.
// Only crop/state pairs with a sizeable dryland area are included.

export type StateCode = 'NSW' | 'QLD' | 'VIC' | 'WA' | 'SA'

export const ABARES_SOURCE = 'ABARES Australian Crop Report, Sept 2026 (state data)'
export const ABARES_URL = 'https://www.agriculture.gov.au/abares/research-topics/agricultural-outlook/australian-crop-report/september-2026'

export const STATE_YIELDS_T_HA: Record<StateCode, Record<string, Record<number, number>>> = {
  NSW: {
    wheat: { 2014: 2.1, 2015: 2.35, 2016: 3.02, 2017: 1.68, 2018: 0.78, 2019: 0.83, 2020: 3.21, 2021: 3.33, 2022: 2.95, 2023: 2.15, 2024: 3.31, 2025: 3.11 },
    barley: { 2014: 2.12, 2015: 2.62, 2016: 2.68, 2017: 1.71, 2018: 1.36, 2019: 1.03, 2020: 3.11, 2021: 3.07, 2022: 2.92, 2023: 2.4, 2024: 3.09, 2025: 3.27 },
    canola: { 2014: 1.45, 2015: 1.65, 2016: 1.59, 2017: 1.04, 2018: 0.65, 2019: 0.63, 2020: 2.1, 2021: 2.25, 2022: 2.0, 2023: 1.9, 2024: 1.92, 2025: 1.68 },
    chickpea: { 2014: 1.35, 2015: 1.23, 2016: 1.65, 2017: 0.9, 2018: 0.38, 2019: 0.37, 2020: 1.68, 2021: 1.8, 2022: 1.2, 2023: 1.1, 2024: 2.21, 2025: 1.82 },
    sorghum: { 2014: 3.18, 2015: 3.91, 2016: 3.3, 2017: 2.58, 2018: 1.46, 2019: 1.78, 2020: 3.8, 2021: 4.83, 2022: 4.2, 2023: 4.22, 2024: 4.72, 2025: 4.2 },
  },
  QLD: {
    wheat: { 2014: 1.56, 2015: 2.15, 2016: 2.41, 2017: 1.2, 2018: 1.0, 2019: 0.95, 2020: 1.65, 2021: 2.36, 2022: 2.65, 2023: 1.5, 2024: 2.48, 2025: 2.62 },
    barley: { 2014: 2.02, 2015: 2.7, 2016: 2.92, 2017: 1.79, 2018: 1.33, 2019: 0.99, 2020: 1.91, 2021: 2.98, 2022: 2.96, 2023: 2.0, 2024: 2.89, 2025: 2.94 },
    chickpea: { 2014: 1.22, 2015: 1.47, 2016: 2.09, 2017: 0.92, 2018: 0.71, 2019: 0.95, 2020: 1.17, 2021: 1.71, 2022: 1.46, 2023: 1.27, 2024: 2.26, 2025: 1.93 },
    sorghum: { 2014: 2.96, 2015: 3.24, 2016: 2.42, 2017: 2.77, 2018: 2.35, 2019: 1.97, 2020: 2.54, 2021: 4.02, 2022: 3.7, 2023: 3.61, 2024: 4.52, 2025: 3.83 },
  },
  VIC: {
    wheat: { 2014: 1.76, 2015: 1.35, 2016: 3.21, 2017: 2.54, 2018: 1.62, 2019: 2.6, 2020: 3.2, 2021: 2.94, 2022: 3.6, 2023: 3.38, 2024: 2.33, 2025: 2.89 },
    barley: { 2014: 1.5, 2015: 1.31, 2016: 3.26, 2017: 2.5, 2018: 1.5, 2019: 2.83, 2020: 2.88, 2021: 2.61, 2022: 3.53, 2023: 3.35, 2024: 2.44, 2025: 3.65 },
    canola: { 2014: 1.16, 2015: 1.04, 2016: 1.94, 2017: 1.73, 2018: 1.23, 2019: 1.81, 2020: 2.28, 2021: 2.29, 2022: 2.58, 2023: 2.36, 2024: 2.11, 2025: 2.31 },
    chickpea: { 2014: 1.98, 2015: 0.26, 2016: 1.75, 2017: 1.02, 2018: 0.74, 2019: 0.68, 2020: 1.06, 2021: 1.33, 2022: 1.6, 2023: 1.2, 2024: 0.92, 2025: 1.38 },
  },
  WA: {
    wheat: { 2014: 1.75, 2015: 1.84, 2016: 2.06, 2017: 1.9, 2018: 2.28, 2019: 1.41, 2020: 2.0, 2021: 2.74, 2022: 3.05, 2023: 1.66, 2024: 2.69, 2025: 3.01 },
    barley: { 2014: 2.44, 2015: 2.35, 2016: 2.43, 2017: 2.47, 2018: 2.53, 2019: 2.1, 2020: 2.5, 2021: 3.06, 2022: 3.61, 2023: 2.31, 2024: 3.33, 2025: 3.95 },
    canola: { 2014: 1.17, 2015: 1.21, 2016: 1.52, 2017: 1.13, 2018: 1.19, 2019: 0.97, 2020: 1.43, 2021: 1.95, 2022: 2.05, 2023: 1.39, 2024: 1.81, 2025: 2.18 },
  },
  SA: {
    wheat: { 2014: 2.25, 2015: 2.08, 2016: 2.82, 2017: 2.05, 2018: 1.66, 2019: 1.56, 2020: 2.17, 2021: 2.37, 2022: 3.34, 2023: 2.23, 2024: 1.35, 2025: 2.37 },
    barley: { 2014: 2.31, 2015: 2.23, 2016: 3.06, 2017: 2.12, 2018: 1.85, 2019: 1.88, 2020: 2.32, 2021: 2.21, 2022: 3.49, 2023: 2.5, 2024: 1.6, 2025: 2.57 },
    canola: { 2014: 1.03, 2015: 1.47, 2016: 1.75, 2017: 1.42, 2018: 1.44, 2019: 1.58, 2020: 1.98, 2021: 1.96, 2022: 2.66, 2023: 2.04, 2024: 1.4, 2025: 2.2 },
  },
}

export const STATE_NAMES: Record<StateCode, string> = {
  NSW: 'New South Wales',
  QLD: 'Queensland',
  VIC: 'Victoria',
  WA: 'Western Australia',
  SA: 'South Australia',
}

// NSW/VIC border: the Murray River (Renmark → Mildura → Swan Hill → Echuca → Albury), then the
// straight line from the Murray's source to Cape Howe. Interpolated linearly between these points.
const MURRAY: [number, number][] = [
  [141.0, -34.0],
  [142.15, -34.17],
  [143.55, -35.33],
  [144.75, -36.12],
  [146.92, -36.1],
  [148.2, -36.8],
  [149.98, -37.5],
]

function murrayLat(lon: number): number {
  if (lon <= MURRAY[0][0]) return MURRAY[0][1]
  for (let i = 1; i < MURRAY.length; i++) {
    const [x0, y0] = MURRAY[i - 1]
    const [x1, y1] = MURRAY[i]
    if (lon <= x1) return y0 + ((lon - x0) / (x1 - x0)) * (y1 - y0)
  }
  return MURRAY[MURRAY.length - 1][1]
}

/** Rough state lookup for the grain belt (good enough to pick the right ABARES series). */
export function grainState(lat: number, lon: number): StateCode | null {
  if (lat > -9 || lat < -44 || lon < 112 || lon > 154) return null
  if (lon < 129) return 'WA'
  if (lon < 141) return lat > -26 ? null : 'SA'
  // East of 141°E: QLD north of the border (~29°S), VIC south of the Murray (approximated as a line).
  if (lat > -29) return 'QLD'
  return lat < murrayLat(lon) ? 'VIC' : 'NSW'
}

export function pearson(a: number[], b: number[]): number | null {
  if (a.length < 3) return null
  const ma = a.reduce((x, y) => x + y, 0) / a.length
  const mb = b.reduce((x, y) => x + y, 0) / b.length
  let n = 0
  let da = 0
  let db = 0
  for (let i = 0; i < a.length; i++) {
    n += (a[i] - ma) * (b[i] - mb)
    da += (a[i] - ma) ** 2
    db += (b[i] - mb) ** 2
  }
  return da && db ? n / Math.sqrt(da * db) : null
}
