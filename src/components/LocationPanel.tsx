import { MapPin, MousePointerClick, SlidersHorizontal, TriangleAlert } from 'lucide-react'
import type { Season } from '../data/crops'
import type { Hub } from '../data/hubs'
import { HUBS, isInAustralia } from '../data/hubs'
import { MapPicker } from './MapPicker'

interface Props {
  lat: number
  lon: number
  hubId: string | null
  flyKey: number
  acres: number
  season: Season
  rainAnomalyPct: number
  tempAnomalyC: number
  pawcMm: number
  onHub: (hub: Hub) => void
  onPick: (lat: number, lon: number) => void
  onAcres: (v: number) => void
  onSeason: (s: Season) => void
  onRain: (v: number) => void
  onTemp: (v: number) => void
  onPawc: (v: number) => void
  onResetClimate: () => void
}

export function LocationPanel(p: Props) {
  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <MapPin className="size-4 text-emerald-400" /> 1. Pick Paddock Location
        </h2>
        <span className="font-mono text-xs text-slate-400">
          {p.lat.toFixed(2)}°, {p.lon.toFixed(2)}°
        </span>
      </div>

      <div>
        <span className="mb-1.5 block text-xs font-semibold text-slate-400">Australian agricultural hubs:</span>
        <div className="grid grid-cols-2 gap-1.5 text-xs sm:grid-cols-3">
          {HUBS.map((h) => {
            const active = h.id === p.hubId
            return (
              <button
                key={h.id}
                onClick={() => p.onHub(h)}
                aria-pressed={active}
                className={`rounded-lg border bg-space-700 px-2.5 py-2 text-left font-medium transition ${
                  active ? 'border-emerald-500/50 text-emerald-300' : 'border-space-600 text-slate-300 hover:bg-space-600'
                }`}
              >
                {h.emoji} {h.label}
              </button>
            )
          })}
        </div>
      </div>

      <div className="relative">
        <MapPicker lat={p.lat} lon={p.lon} flyKey={p.flyKey} onPick={p.onPick} />
        <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded border border-space-700 bg-space-900/90 px-2 py-1 text-[11px] text-slate-300">
          <MousePointerClick className="mr-1 inline size-3 text-emerald-400" /> Click map to drop farm pin
        </div>
      </div>
      {!isInAustralia(p.lat, p.lon) && (
        <p className="flex items-center gap-1.5 text-[11px] text-amber-300">
          <TriangleAlert className="size-3.5" /> Outside Australia — NASA data still loads, but crop economics are calibrated for Australian farms.
        </p>
      )}

      <div className="grid grid-cols-2 gap-4 pt-1">
        <label className="block">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Farm size</span>
            <span className="font-mono text-xs font-bold text-emerald-400">{p.acres.toLocaleString()} acres</span>
          </div>
          <input type="range" min={50} max={3000} step={50} value={p.acres} onChange={(e) => p.onAcres(Number(e.target.value))} className="accent-emerald-500" />
        </label>
        <label className="block">
          <span className="mb-1 block text-xs font-semibold text-slate-300">Target sowing</span>
          <select
            value={p.season}
            onChange={(e) => p.onSeason(e.target.value as Season)}
            className="w-full rounded-lg border border-space-600 bg-space-900 p-2 text-xs text-slate-200 focus:border-emerald-500 focus:outline-none"
          >
            <option value="winter">Autumn / Winter (15 May)</option>
            <option value="spring">Spring / Summer (15 Oct)</option>
          </select>
        </label>
        <label className="col-span-2 block">
          <div className="mb-1 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-300">Soil water capacity (PAWC)</span>
            <span className="font-mono text-xs font-bold text-cyan-300">{p.pawcMm} mm</span>
          </div>
          <input type="range" min={60} max={300} step={10} value={p.pawcMm} onChange={(e) => p.onPawc(Number(e.target.value))} className="accent-cyan-400" />
          <span className="text-[10px] text-slate-500">Sandy soils ≈ 60–120 mm · loams ≈ 150–200 mm · cracking clays ≈ 220–300 mm</span>
        </label>
      </div>

      <div className="space-y-3 rounded-xl border border-cyan-500/20 bg-space-900/90 p-3.5">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-xs font-bold text-cyan-300">
            <SlidersHorizontal className="size-3.5" /> Climate Stress Time Machine
          </span>
          <button onClick={p.onResetClimate} className="text-[11px] text-slate-400 underline hover:text-white">
            Reset
          </button>
        </div>
        <label className="block">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-slate-400">Rainfall anomaly (El Niño stress)</span>
            <span className="font-mono font-bold text-cyan-300">
              {p.rainAnomalyPct > 0 ? '+' : ''}
              {p.rainAnomalyPct}%
            </span>
          </div>
          <input type="range" min={-50} max={40} step={5} value={p.rainAnomalyPct} onChange={(e) => p.onRain(Number(e.target.value))} className="accent-cyan-400" />
        </label>
        <label className="block">
          <div className="mb-1 flex justify-between text-[11px]">
            <span className="text-slate-400">Heatwave shift (temperature)</span>
            <span className="font-mono font-bold text-amber-300">+{p.tempAnomalyC.toFixed(1)}°C</span>
          </div>
          <input type="range" min={0} max={4} step={0.5} value={p.tempAnomalyC} onChange={(e) => p.onTemp(Number(e.target.value))} className="accent-amber-400" />
        </label>
      </div>
    </section>
  )
}
