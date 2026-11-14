import { ExternalLink, Satellite } from 'lucide-react'
import type { SiteSnapshot } from '../engine/model'
import { FROST_THRESHOLD_C } from '../engine/model'
import type { DailySeries } from '../nasa/power'
import { HISTORY_YEARS, POWER_PARAMS } from '../nasa/power'

export function TelemetryPanel({ snap, series, scientist, season }: { snap: SiteSnapshot; series: DailySeries; scientist: boolean; season: string }) {
  const pct = snap.bucketFraction !== null ? Math.round(snap.bucketFraction * 100) : null
  let status = { text: 'Moderate moisture', cls: 'text-amber-400' }
  if (pct === null) status = { text: 'No data', cls: 'text-slate-400' }
  else if (pct < 30) status = { text: 'Critically depleted', cls: 'text-rose-400' }
  else if (pct >= 50) status = { text: 'High stored water', cls: 'text-emerald-400' }

  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <Satellite className="size-4 text-cyan-400" /> 2. NASA Space Telemetry
        </h3>
        <span className="rounded border border-cyan-800 bg-cyan-950 px-2 py-0.5 font-mono text-[11px] text-cyan-400">NASA POWER</span>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-space-700 bg-space-900 p-3.5">
        <div className="relative flex h-20 w-16 shrink-0 flex-col justify-end overflow-hidden rounded-lg border-2 border-space-600 bg-space-800 p-1">
          <div className="w-full rounded-b bg-gradient-to-t from-cyan-600 to-blue-400 transition-all duration-700" style={{ height: `${pct ?? 0}%` }} />
          <span className="absolute inset-0 flex items-center justify-center font-mono text-xs font-bold text-white drop-shadow">{pct ?? '–'}%</span>
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200">Subsoil Water Bucket</span>
            <span className={`text-[11px] font-semibold ${status.cls}`}>{status.text}</span>
          </div>
          <p className="mt-1 text-[11px] leading-relaxed text-slate-400">
            NASA POWER <strong className="text-cyan-300">GWETROOT</strong> root-zone wetness
            {snap.bucketDate ? ` as of ${snap.bucketDate}` : ''}. This is the stored water the next crop starts from.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <Stat label="Last 90-day rain" value={`${Math.round(snap.rain90Mm)} mm`} cls="text-emerald-400" />
        <Stat label={`Frost days (${season === 'winter' ? 'May–Oct' : 'Oct–Mar'})`} value={`${snap.seasonFrostDays.toFixed(1)} / yr`} cls="text-amber-400" />
        <Stat label="Season GDD (base 5°C)" value={`${Math.round(snap.seasonGdd).toLocaleString()}°C·d`} cls="text-cyan-400" />
      </div>

      {scientist && (
        <div className="space-y-1 rounded-lg border border-space-700 bg-space-950 p-3 font-mono text-xs text-slate-300">
          <p className="font-bold text-emerald-400">// NASA POWER daily vector — {snap.latestDate}</p>
          <p>
            T2M_MAX: {snap.tmaxLatest.toFixed(1)}°C | T2M_MIN: {snap.tminLatest.toFixed(1)}°C | PRECTOTCORR: {snap.precipLatest.toFixed(1)} mm/d
          </p>
          <p>
            GWETROOT: {snap.bucketFraction?.toFixed(2) ?? 'n/a'} | ALLSKY_SFC_SW_DWN: {snap.solarLatest?.toFixed(1) ?? 'n/a'} MJ/m²/d
          </p>
          <p className="text-[10px] text-slate-400">
            Record: {series.dates[0]} → {series.dates.at(-1)} ({series.dates.length.toLocaleString()} days, {HISTORY_YEARS} yr) · Elevation{' '}
            {series.elevationM?.toFixed(0) ?? '?'} m · Analogue seasons: {snap.analogueYears}
          </p>
          <p className="text-[10px] text-slate-400">
            Model: GDD = max(0, (Tmax+Tmin)/2 − Tbase), crop-specific Tbase · frost = Tmin &lt; {FROST_THRESHOLD_C}°C · params {POWER_PARAMS.join(', ')}
          </p>
          <a href={series.requestUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-[10px] text-cyan-400 hover:underline">
            Raw API request <ExternalLink className="size-3" />
          </a>
        </div>
      )}
    </section>
  )
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-900 p-2.5">
      <span className="block text-[10px] text-slate-400">{label}</span>
      <span className={`font-mono text-sm font-bold ${cls}`}>{value}</span>
    </div>
  )
}
