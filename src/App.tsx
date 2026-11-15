import { Database, FlaskConical, LoaderCircle, Printer, RefreshCw, Tractor, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { EconomicsPanel } from './components/EconomicsPanel'
import type { Economics } from './components/EconomicsPanel'
import { NasaDataPage } from './components/NasaDataPage'
import { ValidationChart } from './components/ValidationChart'
import type { AreaUnit } from './components/units'
import { fmtArea, fmtPerArea, fmtYield } from './components/units'
import { FarmerReadinessPanel } from './components/FarmerReadinessPanel'
import { DeepDive, Leaderboard, WinnerBanner } from './components/Results'
import { LocationPanel } from './components/LocationPanel'
import { TelemetryPanel } from './components/TelemetryPanel'
import { aud, isoToDate, longDate } from './components/format'
import { CROPS, PRICE_DATE } from './data/crops'
import type { Season } from './data/crops'
import { DEFAULT_PAWC_MM, HUBS } from './data/hubs'
import type { Hub } from './data/hubs'
import type { PreviousCrop } from './data/rotation'
import { PREVIOUS_CROPS } from './data/rotation'
import { ABARES_URL, grainState } from './data/validation'
import { defaultSeason, evaluateCrop, rankCrops, siteSnapshot, SOWING_WINDOWS } from './engine/model'
import { usePowerData } from './nasa/usePowerData'

const LOGO_MARK = `${import.meta.env.BASE_URL}logo-mark.png`
const LOGO_FULL = `${import.meta.env.BASE_URL}logo-full.png`

/** A 1 January "today" puts sowing on the nominal date (15 May / 15 Oct), as in the calibration. */
const VALIDATION_TODAY = new Date(new Date().getFullYear() + 1, 0, 1)

type Mode = 'farmer' | 'scientist'
type Page = 'home' | 'nasa-data'

/** Minimal hash router: #/nasa-data → explainer page, anything else → forecaster.
 *  Hash URLs work on any static host without server rewrites. */
function useHashPage(): Page {
  const read = (): Page => (window.location.hash.replace(/^#\/?/, '') === 'nasa-data' ? 'nasa-data' : 'home')
  const [page, setPage] = useState<Page>(read)
  useEffect(() => {
    const onChange = () => {
      setPage(read())
      window.scrollTo(0, 0)
    }
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return page
}

export default function App() {
  const [hub, setHub] = useState<Hub | null>(HUBS[0])
  const [coords, setCoords] = useState({ lat: HUBS[0].lat, lon: HUBS[0].lon })
  const [customName, setCustomName] = useState<string | null>(null)
  const [areaHa, setAreaHa] = useState(200)
  const [unit, setUnit] = useState<AreaUnit>('ha')
  const [season, setSeason] = useState<Season>(() => defaultSeason())
  const [economics, setEconomics] = useState<Economics>({})
  const [rainAnomalyPct, setRain] = useState(0)
  const [tempAnomalyC, setTemp] = useState(0)
  const [pawcMm, setPawc] = useState(HUBS[0].pawcMm)
  const [irrigationMm, setIrrigation] = useState(0)
  const [previousCrop, setPreviousCrop] = useState<PreviousCrop>('none')
  const [activeId, setActiveId] = useState<string | null>(null)
  const [mode, setMode] = useState<Mode>('farmer')
  const page = useHashPage()

  const { state, retry } = usePowerData(coords.lat, coords.lon)
  const series = state.series

  const analysis = useMemo(() => {
    if (!series) return null
    const scenario = { season, areaHa, rainAnomalyPct, tempAnomalyC, pawcMm, irrigationMm, previousCrop, economics }
    const snap = siteSnapshot(series, scenario)
    // Crops not grown commercially in this region are left out of every list, not just ranked last.
    const all = rankCrops(series, CROPS, scenario)
    const ranked = all.filter((r) => !r.notSuited)
    const unsuited = all.filter((r) => r.notSuited).map((r) => r.crop)
    // Best crop in the other sowing window, offered when nothing pays in this one.
    const otherSeason: Season = season === 'winter' ? 'spring' : 'winter'
    const otherBest = ranked[0].netProfit < 0 ? (rankCrops(series, CROPS, { ...scenario, season: otherSeason }).find((r) => !r.notSuited) ?? null) : null
    return { snap, ranked, unsuited, otherSeason, otherBest }
  }, [series, season, areaHa, rainAnomalyPct, tempAnomalyC, pawcMm, irrigationMm, previousCrop, economics])

  const placeName = hub ? hub.name : (customName ?? `Paddock ${coords.lat.toFixed(2)}°, ${coords.lon.toFixed(2)}°`)
  const scientist = mode === 'scientist'
  const winner = analysis?.ranked[0]
  const active = analysis ? (analysis.ranked.find((r) => r.crop.id === activeId) ?? winner!) : null
  const bucketPct = analysis?.snap.bucketFraction != null ? Math.round(analysis.snap.bucketFraction * 100) : null
  const abaresState = grainState(coords.lat, coords.lon)

  // Model-vs-reality replay for the selected crop: pure history (each year's own soil water,
  // nominal sowing date, no what-if settings), so it can be compared with ABARES yields.
  const activeCrop = active?.crop
  const validationYears = useMemo(() => {
    if (!series || !activeCrop) return []
    const sc = { season: activeCrop.preferredSeason, areaHa: 1, rainAnomalyPct: 0, tempAnomalyC: 0, pawcMm }
    return evaluateCrop(series, activeCrop, sc, { today: VALIDATION_TODAY, startWater: 'each-year' }).years
  }, [series, activeCrop, pawcMm])

  const chooseHub = (h: Hub) => {
    setHub(h)
    setCoords({ lat: h.lat, lon: h.lon })
    setPawc(h.pawcMm)
    setCustomName(null)
  }
  const pickPoint = (lat: number, lon: number, name?: string) => {
    setHub(null)
    setCoords({ lat, lon })
    setCustomName(name ?? null)
    // Soils are regional: within ~1° of a calibrated hub, borrow its typical PAWC.
    const near = HUBS.map((h) => ({ h, d: Math.hypot(h.lat - lat, h.lon - lon) })).sort((a, b) => a.d - b.d)[0]
    setPawc(near.d < 1 ? near.h.pawcMm : DEFAULT_PAWC_MM)
  }

  return (
    <div className="min-h-screen">
      <header className="no-print sticky top-0 z-[1100] border-b border-space-700 bg-space-800/80 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
          <a href="#/" className="flex items-center gap-3">
            <img src={LOGO_MARK} alt="AcreCast AU logo" width={44} height={44} className="size-11 drop-shadow-[0_0_8px_rgba(16,185,129,0.35)]" />
            <div>
              <div className="flex items-center gap-2">
                <span className="bg-gradient-to-r from-emerald-400 via-teal-200 to-cyan-400 bg-clip-text text-xl font-extrabold tracking-tight text-transparent">AcreCast AU</span>
                <span className="hidden rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-400 md:inline">NASA Space Apps 2026</span>
              </div>
              <p className="hidden text-xs text-slate-400 sm:block">Space-Powered Crop Investment & Harvest Forecaster</p>
            </div>
          </a>
          <div className="flex items-center gap-3">
            <a
              href={page === 'nasa-data' ? '#/' : '#/nasa-data'}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-semibold transition ${
                page === 'nasa-data' ? 'border-cyan-500/50 bg-cyan-600 text-white' : 'border-space-600 text-cyan-300 hover:bg-space-700'
              }`}
            >
              <Database className="size-3.5" /> <span className="hidden sm:inline">{page === 'nasa-data' ? 'Back to forecaster' : 'NASA Data Explained'}</span>
            </a>
            {page === 'home' && (
            <>
            <div className="flex items-center rounded-lg border border-space-700 bg-space-900 p-1 text-xs" role="group" aria-label="Area units">
              {(['ha', 'ac'] as const).map((u) => (
                <button
                  key={u}
                  onClick={() => setUnit(u)}
                  aria-pressed={unit === u}
                  className={`rounded-md px-2.5 py-1.5 font-mono font-semibold transition-all ${unit === u ? 'bg-space-600 text-white' : 'text-slate-400 hover:text-white'}`}
                >
                  {u}
                </button>
              ))}
            </div>
            <div className="flex items-center rounded-lg border border-space-700 bg-space-900 p-1 text-xs">
              <button
                onClick={() => setMode('farmer')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${!scientist ? 'bg-emerald-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                <Tractor className="size-3.5" /> <span className="hidden sm:inline">Farmer Mode</span>
              </button>
              <button
                onClick={() => setMode('scientist')}
                className={`flex items-center gap-1.5 rounded-md px-3 py-1.5 font-semibold transition-all ${scientist ? 'bg-cyan-600 text-white shadow' : 'text-slate-400 hover:text-white'}`}
              >
                <FlaskConical className="size-3.5" /> <span className="hidden sm:inline">NASA Telemetry Mode</span>
              </button>
            </div>
            <button
              onClick={() => window.print()}
              disabled={!analysis}
              className="hidden items-center gap-2 rounded-lg border border-space-600 bg-space-700 px-3 py-1.5 text-xs font-medium transition hover:bg-space-600 disabled:opacity-50 md:flex"
            >
              <Printer className="size-3.5" /> Print crop plan
            </button>
            </>
            )}
          </div>
        </div>
      </header>

      {page === 'nasa-data' && <NasaDataPage series={series} placeName={placeName} lat={coords.lat} lon={coords.lon} />}

      {page === 'home' && (
      <>
      <main className="no-print mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <div className="flex flex-col items-start justify-between gap-4 rounded-2xl border border-emerald-500/20 bg-gradient-to-r from-emerald-950/60 via-space-800 to-cyan-950/60 p-5 shadow-xl md:flex-row md:items-center">
          <div>
            <h1 className="flex flex-wrap items-center gap-2 text-lg font-bold text-white md:text-xl">
              Decide Which Crop to Invest in This Season
              <span className="rounded-md border border-emerald-800 bg-emerald-950 px-2.5 py-1 text-xs font-normal text-emerald-400">Australian Grain Belt</span>
            </h1>
            <p className="mt-1 max-w-3xl text-sm text-slate-300">
              Powered by <strong className="text-emerald-400">NASA POWER</strong> daily weather, solar and root-zone soil moisture. We predict{' '}
              <span className="font-semibold text-white">days to harvest</span> and <span className="font-semibold text-emerald-300">net earnings (AUD)</span> before you buy seed.
            </p>
          </div>
          <DataBadge state={state} onRetry={retry} />
        </div>

        <LocationPanel
          lat={coords.lat}
          lon={coords.lon}
          hubId={hub?.id ?? null}
          areaHa={areaHa}
          unit={unit}
          season={season}
          rainAnomalyPct={rainAnomalyPct}
          tempAnomalyC={tempAnomalyC}
          pawcMm={pawcMm}
          irrigationMm={irrigationMm}
          previousCrop={previousCrop}
          onHub={chooseHub}
          onPick={pickPoint}
          onAreaHa={setAreaHa}
          onSeason={setSeason}
          onRain={setRain}
          onTemp={setTemp}
          onPawc={setPawc}
          onIrrigation={setIrrigation}
          onPreviousCrop={setPreviousCrop}
          onResetClimate={() => {
            setRain(0)
            setTemp(0)
            setIrrigation(0)
          }}
        />

        {!analysis && <LoadingCard state={state} onRetry={retry} />}
        {analysis && series && winner && active && (
          <div className={`space-y-6 transition-opacity ${state.status === 'loading' ? 'opacity-50' : ''}`}>
            <WinnerBanner
              winner={winner}
              placeName={placeName}
              areaHa={areaHa}
              unit={unit}
              other={
                analysis.otherBest
                  ? {
                      label: SOWING_WINDOWS[analysis.otherSeason].label,
                      sowDate: analysis.otherBest.sowDate,
                      best: analysis.otherBest,
                      onSwitch: () => setSeason(analysis.otherSeason),
                    }
                  : null
              }
            />
            <Leaderboard
              results={analysis.ranked}
              unsuited={analysis.unsuited}
              activeId={active.crop.id}
              onSelect={setActiveId}
              scientist={scientist}
              placeName={placeName}
              areaHa={areaHa}
              unit={unit}
              rainAnomalyPct={rainAnomalyPct}
              tempAnomalyC={tempAnomalyC}
            />
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-2">
              {scientist ? (
                <TelemetryPanel snap={analysis.snap} series={series} scientist={scientist} season={season} />
              ) : (
                <FarmerReadinessPanel snap={analysis.snap} season={season} />
              )}
              <DeepDive r={active} areaHa={areaHa} unit={unit} scientist={scientist}>
                <ValidationChart cropName={active.crop.name} cropId={active.crop.id} state={abaresState} years={validationYears} unit={unit} factor={active.abaresFactor} />
              </DeepDive>
            </div>
            <EconomicsPanel crops={CROPS} economics={economics} unit={unit} onChange={setEconomics} />
          </div>
        )}
      </main>

      {analysis && active && (
        <div className="print-only hidden bg-white p-8 text-black">
          <div className="mb-4 flex items-center justify-between gap-4 border-b-2 border-black pb-4">
            <img src={LOGO_FULL} alt="AcreCast AU" className="h-20 w-auto" />
            <div className="flex-1">
              <h1 className="text-2xl font-bold">AcreCast AU — Crop Plan</h1>
              <p className="text-sm text-gray-600">NASA Space Apps Challenge 2026 | Adapting Farms with NASA Data</p>
            </div>
            <div className="text-right text-xs">
              <p>Generated: {longDate(new Date())}</p>
              <p>Paddock: {placeName}</p>
              <p>NASA data through: {longDate(isoToDate(analysis.snap.latestDate))}</p>
            </div>
          </div>
          <div className="space-y-2 rounded border p-4 text-sm">
            <h2 className="text-lg font-bold">Selected crop: {active.crop.name}</h2>
            <p>
              <strong>Paddock size:</strong> {fmtArea(areaHa, unit)} · <strong>Sowing:</strong> {longDate(active.sowDate)} · <strong>Est. harvest:</strong>{' '}
              {active.harvestDate ? `${longDate(active.harvestDate)} (${active.daysToHarvest} days)` : 'does not mature'}
            </p>
            <p>
              <strong>Expected gross margin:</strong> {aud(active.netProfit, true)} AUD ({fmtPerArea(active.netProfit / areaHa, unit, true)}, {active.roiPct}% return on growing costs) · <strong>Loss risk:</strong>{' '}
              {Math.round(active.lossProbability * 100)}% of {active.years.length} past seasons · <strong>Worst season:</strong> {aud(active.worstProfit, true)}
            </p>
            <p>
              <strong>Scenario:</strong> rainfall {rainAnomalyPct}% · temperature +{tempAnomalyC}°C · plant-available soil water today {bucketPct}% of {pawcMm} mm PAWC · irrigation{' '}
              {irrigationMm} mm · previous crop: {previousCrop === 'none' ? 'none' : PREVIOUS_CROPS.find((c) => c.id === previousCrop)?.label}
            </p>
          </div>
          <table className="mt-4 w-full text-left text-sm">
            <thead>
              <tr className="border-b">
                <th>Rank</th>
                <th>Crop</th>
                <th>Days</th>
                <th>Yield</th>
                <th>Gross margin</th>
                <th>Loss risk</th>
                <th>Score</th>
              </tr>
            </thead>
            <tbody>
              {analysis.ranked.map((r, i) => (
                <tr key={r.crop.id} className="border-b">
                  <td>{i + 1}</td>
                  <td>{r.crop.name}</td>
                  <td>{r.daysToHarvest ?? '—'}</td>
                  <td>{fmtYield(r.yieldTHa, unit)}</td>
                  <td>{aud(r.netProfit, true)}</td>
                  <td>{Math.round(r.lossProbability * 100)}%</td>
                  <td>{r.score}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-4 text-xs text-gray-600">
            Based on NASA POWER daily agroclimatology (T2M_MAX, T2M_MIN, PRECTOTCORR, GWETROOT, ALLSKY_SFC_SW_DWN). Yield model calibrated against ABARES state yields 2014–2025.
            Prices: ABARES export prices ({PRICE_DATE}) less freight; chickpeas from ABARES quarterly prices; mungbeans from the Australian Mungbean Association (2026); growing costs are indicative. Indicative planning tool, not financial advice.
          </p>
        </div>
      )}

      </>
      )}

      <footer className="no-print border-t border-space-800 py-6 text-center text-xs text-slate-400">
        <p>AcreCast AU — Built for NASA Space Apps Challenge 2026 (Field Shift: Adapting Farms with NASA Data).</p>
        <p className="mt-1">
          Data: <a className="underline hover:text-white" href="https://power.larc.nasa.gov/" target="_blank" rel="noreferrer">NASA POWER</a> Agroclimatology API (<a className="underline hover:text-white" href="#/nasa-data">how we use it</a>). Yields checked against <a className="underline hover:text-white" href={ABARES_URL} target="_blank" rel="noreferrer">ABARES</a> crop data; grain prices from ABARES ({PRICE_DATE}). Indicative planning tool — not financial advice.
        </p>
      </footer>
    </div>
  )
}

function DataBadge({ state, onRetry }: { state: ReturnType<typeof usePowerData>['state']; onRetry: () => void }) {
  if (state.status === 'loading')
    return (
      <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1 text-xs font-medium text-cyan-300">
        <LoaderCircle className="size-3.5 animate-spin" /> Fetching NASA POWER…
      </span>
    )
  if (state.status === 'error')
    return (
      <button onClick={onRetry} className="inline-flex shrink-0 items-center gap-2 rounded-full border border-rose-500/40 bg-rose-500/10 px-3 py-1 text-xs font-medium text-rose-300">
        <TriangleAlert className="size-3.5" /> NASA feed unavailable — retry <RefreshCw className="size-3" />
      </button>
    )
  const last = state.series.dates.at(-1)!
  const label = state.source === 'stale-cache' ? 'Offline — cached NASA data' : 'NASA POWER live data'
  return (
    <span className="inline-flex shrink-0 flex-col items-end gap-0.5">
      <span
        className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-medium ${
          state.source === 'stale-cache' ? 'border-amber-500/30 bg-amber-500/10 text-amber-300' : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
        }`}
      >
        <span className={`mr-2 size-2 rounded-full ${state.source === 'stale-cache' ? 'bg-amber-400' : 'animate-pulse bg-emerald-400'}`} />
        {label}
      </span>
      <span className="text-[10px] text-slate-400">observations through {longDate(isoToDate(last))}</span>
    </span>
  )
}

function LoadingCard({ state, onRetry }: { state: ReturnType<typeof usePowerData>['state']; onRetry: () => void }) {
  return (
    <div className="flex min-h-64 flex-col items-center justify-center gap-3 rounded-2xl border border-space-700 bg-space-800 p-8 text-center">
      {state.status === 'error' ? (
        <>
          <TriangleAlert className="size-8 text-rose-400" />
          <p className="text-sm text-slate-300">Couldn’t load NASA POWER data: {state.error}</p>
          <button onClick={onRetry} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500">
            Try again
          </button>
        </>
      ) : (
        <>
          <img src={LOGO_MARK} alt="" className="size-16 animate-pulse" />
          <p className="text-sm text-slate-300">Downloading 10 years of NASA POWER daily data for this paddock…</p>
        </>
      )}
    </div>
  )
}
