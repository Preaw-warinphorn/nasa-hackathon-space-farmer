import { Check, Crosshair, Expand, History, LoaderCircle, MapPin, PenLine, Search, Shrink, SlidersHorizontal, Trash2, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import type { Season } from '../data/crops'
import type { Hub } from '../data/hubs'
import { HUBS, isInAustralia } from '../data/hubs'
import type { PreviousCrop } from '../data/rotation'
import { IRRIGATION_AUD_PER_MM_HA, PREVIOUS_CROPS } from '../data/rotation'
import type { LatLon } from '../engine/geo'
import { dedupePoints, polygonAreaHa, polygonCenter } from '../engine/geo'
import { nextSowDate, SOWING_WINDOWS } from '../engine/model'
import { shortDate } from './format'
import type { AreaUnit } from './units'
import { fmtArea, fromUnit, HA_PER_AC, toUnit } from './units'
import type { FlyTarget } from './MapPicker'
import { MapPicker } from './MapPicker'

interface Props {
  lat: number
  lon: number
  hubId: string | null
  areaHa: number
  unit: AreaUnit
  season: Season
  rainAnomalyPct: number
  tempAnomalyC: number
  pawcMm: number
  irrigationMm: number
  previousCrop: PreviousCrop
  onHub: (hub: Hub) => void
  onPick: (lat: number, lon: number, name?: string) => void
  onAreaHa: (v: number) => void
  onSeason: (s: Season) => void
  onRain: (v: number) => void
  onTemp: (v: number) => void
  onPawc: (v: number) => void
  onIrrigation: (v: number) => void
  onPreviousCrop: (v: PreviousCrop) => void
  onResetClimate: () => void
}

type Status = { kind: 'idle' } | { kind: 'busy'; text: string } | { kind: 'error'; text: string }

const PREV_NOTES: Partial<Record<PreviousCrop, { text: string; cls: string }>> = {
  pulse: { text: 'Legume legacy: ~50 kg N/ha left in the soil. Cereals gain yield and need less fertiliser.', cls: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
  cereal: { text: 'Rotate into a pulse or sorghum to break root disease and avoid a cereal-on-cereal penalty.', cls: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
  canola: { text: 'Blackleg risk if canola goes in again.', cls: 'border-rose-500/40 bg-rose-950/40 text-rose-300' },
  cotton: { text: 'Deep moisture used up. Low-water pulses or sorghum are the safer pick.', cls: 'border-amber-500/40 bg-amber-950/40 text-amber-300' },
  fallow: { text: 'Rested paddock: extra stored moisture and nutrients for every crop.', cls: 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300' },
}

export function LocationPanel(p: Props) {
  const [fly, setFly] = useState<FlyTarget | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const [points, setPoints] = useState<LatLon[]>([])
  const [boundary, setBoundary] = useState<LatLon[] | null>(null)
  const [query, setQuery] = useState('')
  const [status, setStatus] = useState<Status>({ kind: 'idle' })

  const flyTo = (lat: number, lon: number, zoom: number) => setFly((f) => ({ lat, lon, zoom, key: (f?.key ?? 0) + 1 }))

  const search = async () => {
    const q = query.trim()
    if (!q) return
    setStatus({ kind: 'busy', text: 'Searching…' })
    try {
      const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=au&q=${encodeURIComponent(q)}`
      const res = await fetch(url, { headers: { Accept: 'application/json' } })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const data = (await res.json()) as { lat: string; lon: string; display_name: string }[]
      if (!data.length) {
        setStatus({ kind: 'error', text: `No Australian place found for “${q}”. Try a town like Toowoomba, Narrabri or Mildura.` })
        return
      }
      const lat = Number(data[0].lat)
      const lon = Number(data[0].lon)
      p.onPick(lat, lon, data[0].display_name.split(',').slice(0, 2).join(','))
      flyTo(lat, lon, 12)
      setStatus({ kind: 'idle' })
    } catch {
      setStatus({ kind: 'error', text: 'Place search is unavailable right now. Click the map to set your farm instead.' })
    }
  }

  const locate = () => {
    if (!navigator.geolocation) {
      setStatus({ kind: 'error', text: 'This browser can’t share its location.' })
      return
    }
    setStatus({ kind: 'busy', text: 'Finding your GPS position…' })
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude: lat, longitude: lon } = pos.coords
        p.onPick(lat, lon)
        flyTo(lat, lon, 13)
        setStatus({ kind: 'idle' })
      },
      (err) => setStatus({ kind: 'error', text: `Couldn’t get your location (${err.message}). Click the map instead.` }),
      { enableHighAccuracy: true, timeout: 10_000 },
    )
  }

  const startDrawing = () => {
    setPoints([])
    setDrawing(true)
  }
  const finishDrawing = () => {
    const pts = dedupePoints(points)
    if (pts.length < 3) {
      setStatus({ kind: 'error', text: 'Click at least 3 corners around your paddock first.' })
      return
    }
    const ha = Math.max(0.5, polygonAreaHa(pts))
    const [lat, lon] = polygonCenter(pts)
    setBoundary(pts)
    setDrawing(false)
    setPoints([])
    setStatus({ kind: 'idle' })
    p.onAreaHa(Math.round(ha * 10) / 10)
    p.onPick(lat, lon)
  }
  const clearBoundary = () => {
    setBoundary(null)
    setPoints([])
    setDrawing(false)
  }

  const liveHa = drawing && points.length >= 3 ? polygonAreaHa(dedupePoints(points)) : null
  const boundaryHa = boundary ? polygonAreaHa(boundary) : null
  // Slider works in the display unit; the app stores hectares.
  const sliderMin = p.unit === 'ha' ? 20 : 50
  const sliderMax = p.unit === 'ha' ? 1500 : 3500
  const sliderStep = p.unit === 'ha' ? 5 : 10
  const shown = Math.round(toUnit(p.areaHa, p.unit))
  const prevNote = PREV_NOTES[p.previousCrop]

  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-xl">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
            <MapPin className="size-4 text-emerald-400" /> Pick Paddock & Draw Boundary
          </h2>
          <p className="mt-0.5 text-xs text-slate-400">
            Drop a pin anywhere in Australia, search for a town, or use the <strong className="text-emerald-300">pen tool</strong> to trace your fence lines.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <button
            onClick={locate}
            className="flex items-center gap-1.5 rounded-lg border border-emerald-500/40 bg-emerald-600/30 px-3 py-1.5 text-xs font-medium text-emerald-300 transition hover:bg-emerald-600 hover:text-white"
          >
            <Crosshair className="size-3.5" /> Use my GPS
          </button>
          <span className="rounded-lg border border-space-700 bg-space-900 px-2.5 py-1.5 font-mono text-xs text-slate-300">
            {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5 md:grid-cols-12">
        <form
          className="flex gap-1.5 md:col-span-5"
          onSubmit={(e) => {
            e.preventDefault()
            void search()
          }}
        >
          <div className="relative flex-1">
            <Search className="absolute left-3 top-2.5 size-3.5 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search an Australian town or postcode (e.g. Moree, Dalby, 2650)"
              className="w-full rounded-lg border border-space-600 bg-space-900 py-2 pl-8 pr-3 text-xs text-slate-200 placeholder-slate-500 focus:border-emerald-500 focus:outline-none"
            />
          </div>
          <button type="submit" className="shrink-0 rounded-lg border border-space-600 bg-space-700 px-3.5 py-2 text-xs font-semibold text-slate-200 transition hover:bg-space-600">
            Search
          </button>
        </form>

        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-space-700 bg-space-900/90 p-1.5 text-xs md:col-span-7">
          <div className="flex flex-wrap items-center gap-1.5">
            {!drawing ? (
              <button onClick={startDrawing} className="flex items-center gap-1.5 rounded-md border border-space-600 bg-space-700 px-3 py-1.5 font-medium text-slate-200 transition hover:bg-space-600">
                <PenLine className="size-3.5 text-emerald-400" /> Draw paddock
              </button>
            ) : (
              <>
                <span className="flex items-center gap-1.5 rounded-md bg-emerald-600 px-3 py-1.5 font-bold text-white ring-2 ring-emerald-400">
                  <PenLine className="size-3.5 animate-bounce" /> Drawing…
                </span>
                <button onClick={finishDrawing} className="flex items-center gap-1 rounded-md bg-emerald-600 px-3 py-1.5 font-bold text-white shadow transition hover:bg-emerald-500">
                  <Check className="size-3.5" /> Finish boundary
                </button>
              </>
            )}
            {(drawing || boundary) && (
              <button
                onClick={clearBoundary}
                className="flex items-center gap-1 rounded-md border border-space-700 bg-space-800 px-2.5 py-1.5 text-slate-400 transition hover:border-rose-700 hover:text-rose-300"
              >
                <Trash2 className="size-3.5" /> Clear
              </button>
            )}
            <button
              onClick={() => setExpanded((x) => !x)}
              className="flex items-center gap-1 rounded-md border border-space-600 bg-space-800 px-2.5 py-1.5 text-slate-300 transition hover:bg-space-700 hover:text-white"
            >
              {expanded ? <Shrink className="size-3.5" /> : <Expand className="size-3.5" />} {expanded ? 'Normal size' : 'Expand map'}
            </button>
          </div>
          {boundaryHa !== null && !drawing && (
            <span className="rounded border border-emerald-800 bg-emerald-950 px-2.5 py-1 font-mono text-[11px] font-bold text-emerald-300">
              Paddock: <span className="text-white">{fmtArea(boundaryHa, p.unit)}</span>
            </span>
          )}
        </div>
      </div>

      {drawing && (
        <div className="flex items-center gap-2 rounded-lg border border-emerald-500/40 bg-emerald-950/70 p-2.5 text-xs text-emerald-300">
          <Crosshair className="size-3.5 shrink-0" />
          {liveHa === null ? (
            <span>
              Zoom in to your paddock, then click each corner along the fence. Click <strong>Finish boundary</strong> (or double-click) to measure it.
            </span>
          ) : (
            <span>
              {dedupePoints(points).length} corners placed. Area: <strong className="rounded bg-space-900 px-2 py-0.5 font-mono text-sm text-white">{fmtArea(liveHa, p.unit)}</strong>
            </span>
          )}
        </div>
      )}
      {status.kind !== 'idle' && (
        <p className={`flex items-center gap-1.5 text-xs ${status.kind === 'busy' ? 'text-cyan-300' : 'text-amber-300'}`}>
          {status.kind === 'busy' ? <LoaderCircle className="size-3.5 animate-spin" /> : <TriangleAlert className="size-3.5" />} {status.text}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <span className="mr-1 flex items-center gap-1 text-xs font-semibold text-slate-400">
          <MapPin className="size-3.5 text-emerald-400" /> Ag hubs:
        </span>
        <div className="grid flex-1 grid-cols-2 gap-2 text-xs sm:grid-cols-3 lg:grid-cols-6">
          {HUBS.map((h) => {
            const active = h.id === p.hubId
            return (
              <button
                key={h.id}
                onClick={() => {
                  p.onHub(h)
                  flyTo(h.lat, h.lon, 9)
                }}
                aria-pressed={active}
                className={`rounded-lg border bg-space-700 px-3 py-1.5 text-left font-medium transition ${
                  active ? 'border-emerald-500/50 text-emerald-300' : 'border-space-600 text-slate-300 hover:bg-space-600'
                }`}
              >
                {h.emoji} {h.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-space-600 shadow-2xl">
        <MapPicker
          lat={p.lat}
          lon={p.lon}
          fly={fly}
          expanded={expanded}
          drawing={drawing}
          points={points}
          boundary={boundary}
          onPick={(lat, lon) => p.onPick(lat, lon)}
          onAddPoint={(pt) => setPoints((ps) => [...ps, pt])}
          onFinish={finishDrawing}
        />
      </div>
      {!isInAustralia(p.lat, p.lon) && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
          <TriangleAlert className="size-3.5" /> Outside Australia. NASA data still loads, but crop economics are calibrated for Australian farms.
        </p>
      )}

      <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-5">
        <Card>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Paddock size</span>
            <span className="font-mono text-xs font-bold text-emerald-400">{fmtArea(p.areaHa, p.unit)}</span>
          </div>
          <input
            type="range"
            min={Math.min(sliderMin, shown)}
            max={Math.max(sliderMax, shown)}
            step={sliderStep}
            value={shown}
            onChange={(e) => p.onAreaHa(fromUnit(Number(e.target.value), p.unit))}
            className="accent-emerald-500"
            aria-label={`Paddock size in ${p.unit === 'ha' ? 'hectares' : 'acres'}`}
          />
          <span className="mt-1 block text-[10px] text-slate-400">Set by the pen tool, or drag</span>
        </Card>

        <Card>
          <label className="mb-1 block text-xs font-semibold text-slate-300" htmlFor="sowing">
            Target sowing
          </label>
          <select
            id="sowing"
            value={p.season}
            onChange={(e) => p.onSeason(e.target.value as Season)}
            className="w-full rounded-lg border border-emerald-500/50 bg-space-900 p-2 text-xs font-semibold text-emerald-300 focus:border-emerald-400 focus:outline-none"
          >
            {(['spring', 'winter'] as const).map((s) => (
              <option key={s} value={s}>
                {SOWING_WINDOWS[s].label} · {shortDate(nextSowDate(s))}
              </option>
            ))}
          </select>
          <span className="mt-1 block text-[10px] text-slate-400">Defaults to the next sowing window. Inside a window, sowing is today.</span>
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Extra irrigation</span>
            <span className="font-mono text-xs font-bold text-cyan-400">{p.irrigationMm} mm</span>
          </div>
          <input
            type="range"
            min={0}
            max={150}
            step={10}
            value={p.irrigationMm}
            onChange={(e) => p.onIrrigation(Number(e.target.value))}
            className="accent-cyan-400"
            aria-label="Supplemental irrigation in mm"
          />
          <span className="mt-1 block text-right font-mono text-[10px] text-slate-400">
            ${(p.unit === 'ha' ? IRRIGATION_AUD_PER_MM_HA : IRRIGATION_AUD_PER_MM_HA * HA_PER_AC).toFixed(2)}/mm/{p.unit}
          </span>
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Soil water capacity</span>
            <span className="font-mono text-xs font-bold text-cyan-300">{p.pawcMm} mm</span>
          </div>
          <input
            type="range"
            min={60}
            max={300}
            step={10}
            value={p.pawcMm}
            onChange={(e) => p.onPawc(Number(e.target.value))}
            className="accent-cyan-400"
            aria-label="Plant-available water capacity in mm"
          />
          <span className="mt-1 block text-[10px] text-slate-400">Sand ≈ 60–120 · loam ≈ 150–200 · clay ≈ 220–300</span>
        </Card>

        <Card>
          <div className="mb-1 flex items-center justify-between">
            <label className="flex items-center gap-1 text-xs font-semibold text-slate-300" htmlFor="prev-crop">
              <History className="size-3.5 text-cyan-400" /> Previous crop
            </label>
            <span className="font-mono text-[10px] text-cyan-400">{p.previousCrop === 'none' ? 'New paddock' : 'Rotation on'}</span>
          </div>
          <select
            id="prev-crop"
            value={p.previousCrop}
            onChange={(e) => p.onPreviousCrop(e.target.value as PreviousCrop)}
            className="w-full rounded-lg border border-cyan-500/50 bg-space-900 p-2 text-xs font-semibold text-cyan-300 focus:border-cyan-400 focus:outline-none"
          >
            {PREVIOUS_CROPS.map((c) => (
              <option key={c.id} value={c.id}>
                {c.label}
              </option>
            ))}
          </select>
          {prevNote && <p className={`mt-1.5 rounded border p-1.5 text-[11px] leading-tight ${prevNote.cls}`}>{prevNote.text}</p>}
        </Card>
      </div>

      <div className="rounded-xl border border-cyan-500/20 bg-space-900/90 p-3.5">
        <div className="mb-2 flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <SlidersHorizontal className="size-3.5" /> Climate Stress Time Machine (what-if)
          </span>
          <button onClick={p.onResetClimate} className="text-xs text-slate-400 underline hover:text-white">
            Reset
          </button>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <label className="block">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-400">Rainfall anomaly (El Niño stress)</span>
              <span className="font-mono font-bold text-cyan-300">
                {p.rainAnomalyPct > 0 ? '+' : ''}
                {p.rainAnomalyPct}%
              </span>
            </div>
            <input type="range" min={-50} max={40} step={5} value={p.rainAnomalyPct} onChange={(e) => p.onRain(Number(e.target.value))} className="accent-cyan-400" />
          </label>
          <label className="block">
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-slate-400">Heatwave shift (temperature)</span>
              <span className="font-mono font-bold text-amber-300">+{p.tempAnomalyC.toFixed(1)}°C</span>
            </div>
            <input type="range" min={0} max={4} step={0.5} value={p.tempAnomalyC} onChange={(e) => p.onTemp(Number(e.target.value))} className="accent-amber-400" />
          </label>
        </div>
      </div>
    </section>
  )
}

function Card({ children }: { children: ReactNode }) {
  return <div className="rounded-xl border border-space-700/80 bg-space-900/80 p-3">{children}</div>
}
