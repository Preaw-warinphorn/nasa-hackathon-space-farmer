// NASA POWER (Prediction Of Worldwide Energy Resources) daily point API client.
// Docs: https://power.larc.nasa.gov/docs/services/api/temporal/daily/
// This is the single place that talks to NASA — add further sources (SMAP, ECOSTRESS) alongside it.

export const POWER_PARAMS = ['T2M_MAX', 'T2M_MIN', 'PRECTOTCORR', 'GWETROOT', 'ALLSKY_SFC_SW_DWN'] as const
export const HISTORY_YEARS = 10

export interface DailySeries {
  lat: number
  lon: number
  elevationM: number | null
  /** ISO dates (YYYY-MM-DD), contiguous, one per day. */
  dates: string[]
  tmax: number[]
  tmin: number[]
  precip: number[]
  /** Root-zone soil wetness, 0–1 (fraction of saturation). NaN where missing. */
  gwet: number[]
  /** All-sky surface shortwave, MJ/m²/day. NaN where missing. */
  solar: number[]
  fetchedAt: number
  requestUrl: string
  /** Upstream datasets NASA POWER reports for this response (e.g. MERRA2, SYN1DEG). */
  sources?: string[]
  apiVersion?: string
  /** Official long names and units per parameter, as returned by the API. */
  paramInfo?: Record<string, { longname: string; units: string }>
}

export type DataSource = 'live' | 'cache' | 'stale-cache'

export interface PowerResult {
  series: DailySeries
  source: DataSource
}

const CACHE_PREFIX = 'acrecast:power:v2:'
export const CACHE_TTL_MS = 12 * 60 * 60 * 1000

function ymd(d: Date): string {
  return `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`
}

export function buildPowerUrl(lat: number, lon: number, now = new Date()): string {
  const start = new Date(Date.UTC(now.getUTCFullYear() - HISTORY_YEARS, 0, 1))
  const params = new URLSearchParams({
    parameters: POWER_PARAMS.join(','),
    community: 'AG',
    latitude: lat.toFixed(4),
    longitude: lon.toFixed(4),
    start: ymd(start),
    end: ymd(now),
    format: 'JSON',
  })
  return `https://power.larc.nasa.gov/api/temporal/daily/point?${params}`
}

interface PowerJson {
  geometry?: { coordinates?: number[] }
  properties?: { parameter?: Record<string, Record<string, number>> }
  header?: { fill_value?: number; sources?: string[]; api?: { version?: string } }
  parameters?: Record<string, { longname: string; units: string }>
  messages?: string[]
}

/** Parse a POWER JSON response. Fill values become NaN; trailing days with no temperature are dropped;
 *  isolated temperature gaps are forward-filled so thermal time stays continuous. */
export function parsePowerJson(json: PowerJson, lat: number, lon: number, requestUrl: string): DailySeries {
  const p = json.properties?.parameter
  if (!p || !p.T2M_MAX) {
    throw new Error(json.messages?.join(' ') || 'Unexpected NASA POWER response')
  }
  const fill = json.header?.fill_value ?? -999
  const clean = (v: number | undefined) => (v === undefined || v === fill || v <= -990 ? NaN : v)

  const keys = Object.keys(p.T2M_MAX).sort()
  // Drop trailing days where temperature is not yet published.
  let last = keys.length - 1
  while (last >= 0 && (Number.isNaN(clean(p.T2M_MAX[keys[last]])) || Number.isNaN(clean(p.T2M_MIN?.[keys[last]])))) last--
  const used = keys.slice(0, last + 1)

  const series: DailySeries = {
    lat,
    lon,
    elevationM: json.geometry?.coordinates?.[2] ?? null,
    dates: used.map((k) => `${k.slice(0, 4)}-${k.slice(4, 6)}-${k.slice(6, 8)}`),
    tmax: [],
    tmin: [],
    precip: [],
    gwet: [],
    solar: [],
    fetchedAt: Date.now(),
    requestUrl,
    sources: json.header?.sources,
    apiVersion: json.header?.api?.version,
    paramInfo: json.parameters,
  }
  let prevMax = NaN
  let prevMin = NaN
  for (const k of used) {
    let tx = clean(p.T2M_MAX[k])
    let tn = clean(p.T2M_MIN?.[k])
    if (Number.isNaN(tx)) tx = prevMax
    if (Number.isNaN(tn)) tn = prevMin
    prevMax = tx
    prevMin = tn
    series.tmax.push(tx)
    series.tmin.push(tn)
    const pr = clean(p.PRECTOTCORR?.[k])
    series.precip.push(Number.isNaN(pr) ? 0 : pr)
    series.gwet.push(clean(p.GWETROOT?.[k]))
    series.solar.push(clean(p.ALLSKY_SFC_SW_DWN?.[k]))
  }
  if (series.dates.length < 400) throw new Error('NASA POWER returned too little data for this location')
  return series
}

function cacheKey(lat: number, lon: number) {
  return `${CACHE_PREFIX}${lat.toFixed(2)},${lon.toFixed(2)}`
}

function readCache(lat: number, lon: number): DailySeries | null {
  try {
    const raw = localStorage.getItem(cacheKey(lat, lon))
    if (!raw) return null
    const s = JSON.parse(raw) as DailySeries
    // JSON turns NaN into null — restore.
    for (const f of ['tmax', 'tmin', 'precip', 'gwet', 'solar'] as const) s[f] = s[f].map((v) => (v === null ? NaN : v))
    return s
  } catch {
    return null
  }
}

function writeCache(s: DailySeries) {
  const key = cacheKey(s.lat, s.lon)
  const value = JSON.stringify(s)
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      localStorage.setItem(key, value)
      return
    } catch {
      // Quota exceeded: evict the oldest cached location and retry.
      const entries = Object.keys(localStorage)
        .filter((k) => k.startsWith(CACHE_PREFIX) && k !== key)
        .map((k) => ({ k, t: (JSON.parse(localStorage.getItem(k) || '{}') as Partial<DailySeries>).fetchedAt ?? 0 }))
        .sort((a, b) => a.t - b.t)
      if (!entries.length) return
      localStorage.removeItem(entries[0].k)
    }
  }
}

export async function fetchPowerDaily(lat: number, lon: number, signal?: AbortSignal): Promise<PowerResult> {
  const cached = readCache(lat, lon)
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) return { series: cached, source: 'cache' }

  const url = buildPowerUrl(lat, lon)
  try {
    const res = await fetch(url, { signal })
    const json = (await res.json()) as PowerJson
    if (!res.ok) throw new Error(json.messages?.join(' ') || `NASA POWER HTTP ${res.status}`)
    const series = parsePowerJson(json, lat, lon, url)
    writeCache(series)
    return { series, source: 'live' }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    if (cached) return { series: cached, source: 'stale-cache' }
    throw err
  }
}
