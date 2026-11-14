import { ExternalLink, Scale } from 'lucide-react'
import { useState } from 'react'
import type { YearRun } from '../engine/model'
import type { StateCode } from '../data/validation'
import { ABARES_SOURCE, ABARES_URL, pearson, STATE_NAMES, STATE_YIELDS_T_HA } from '../data/validation'
import type { AreaUnit } from './units'
import { HA_PER_AC } from './units'

// Palette validated (dataviz validate_palette.js, dark surface #0b1120): cyan-600 / amber-600.
const MODEL = '#0891b2'
const OBS = '#d97706'

const W = 640
const H = 240
const PAD = { l: 40, r: 74, t: 14, b: 26 }

/** Year-by-year model yield (each year's own weather and soil water) against the ABARES state average. */
export function ValidationChart({ cropName, cropId, state, years, unit }: { cropName: string; cropId: string; state: StateCode | null; years: YearRun[]; unit: AreaUnit }) {
  const [hover, setHover] = useState<number | null>(null)
  const table = state ? STATE_YIELDS_T_HA[state][cropId] : undefined
  const k = unit === 'ha' ? 1 : HA_PER_AC
  const pts = table ? years.filter((y) => table[y.sowYear] !== undefined).map((y) => ({ year: y.sowYear, model: y.yieldTHa * k, obs: table[y.sowYear] * k })) : []

  if (!state || pts.length < 3)
    return (
      <Shell>
        <p className="text-xs text-slate-400">
          No ABARES comparison here: {!state ? 'this point is outside the main grain states.' : `ABARES doesn’t report a ${cropName.toLowerCase()} series for ${STATE_NAMES[state]} with enough dryland area.`}
        </p>
      </Shell>
    )

  const r = pearson(
    pts.map((p) => p.model),
    pts.map((p) => p.obs),
  )
  const meanModel = pts.reduce((a, p) => a + p.model, 0) / pts.length
  const meanObs = pts.reduce((a, p) => a + p.obs, 0) / pts.length
  const yMax = Math.max(1, ...pts.flatMap((p) => [p.model, p.obs])) * 1.1
  const x0 = pts[0].year
  const x1 = pts[pts.length - 1].year
  const sx = (y: number) => PAD.l + ((y - x0) / Math.max(1, x1 - x0)) * (W - PAD.l - PAD.r)
  const sy = (v: number) => PAD.t + (1 - v / yMax) * (H - PAD.t - PAD.b)
  const path = (key: 'model' | 'obs') => pts.map((p, i) => `${i ? 'L' : 'M'}${sx(p.year).toFixed(1)},${sy(p[key]).toFixed(1)}`).join(' ')
  const ticks = niceTicks(yMax)
  const last = pts[pts.length - 1]
  const h = hover !== null ? pts[hover] : null
  // Keep end labels from colliding.
  let labModel = sy(last.model)
  let labObs = sy(last.obs)
  if (Math.abs(labModel - labObs) < 14) {
    const mid = (labModel + labObs) / 2
    const up = labModel < labObs ? -7 : 7
    labModel = mid + up
    labObs = mid - up
  }

  return (
    <Shell>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-300">
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" y1="4" x2="21" y2="4" stroke={MODEL} strokeWidth="2" />
            <circle cx="11" cy="4" r="3" fill={MODEL} />
          </svg>
          AcreCast model at this paddock
        </span>
        <span className="flex items-center gap-1.5">
          <svg width="22" height="8" aria-hidden>
            <line x1="1" y1="4" x2="21" y2="4" stroke={OBS} strokeWidth="2" strokeDasharray="4 3" />
            <rect x="8" y="1" width="6" height="6" fill={OBS} />
          </svg>
          ABARES {STATE_NAMES[state]} average
        </span>
        <span className="ml-auto font-mono text-slate-400">
          r = {r?.toFixed(2) ?? '–'} · mean {meanModel.toFixed(2)} vs {meanObs.toFixed(2)} t/{unit}
        </span>
      </div>

      <div className="relative">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="h-auto w-full"
          role="img"
          aria-label={`${cropName} yield, model versus ABARES ${STATE_NAMES[state]} average, ${x0} to ${x1}`}
          onMouseLeave={() => setHover(null)}
        >
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.l} x2={W - PAD.r} y1={sy(t)} y2={sy(t)} stroke="#1e293b" strokeWidth="1" />
              <text x={PAD.l - 6} y={sy(t) + 3} textAnchor="end" className="fill-slate-500 font-mono" fontSize="10">
                {t.toFixed(t < 10 && yMax < 4 ? 1 : 0)}
              </text>
            </g>
          ))}
          <text x={PAD.l - 6} y={PAD.t - 3} textAnchor="end" className="fill-slate-500" fontSize="9">
            t/{unit}
          </text>
          {pts.map((p) => (
            <text key={p.year} x={sx(p.year)} y={H - 8} textAnchor="middle" className="fill-slate-500 font-mono" fontSize="10">
              {String(p.year).slice(2)}
            </text>
          ))}
          {h && <line x1={sx(h.year)} x2={sx(h.year)} y1={PAD.t} y2={H - PAD.b} stroke="#475569" strokeWidth="1" />}
          <path d={path('obs')} fill="none" stroke={OBS} strokeWidth="2" strokeDasharray="5 4" strokeLinejoin="round" />
          <path d={path('model')} fill="none" stroke={MODEL} strokeWidth="2" strokeLinejoin="round" />
          {pts.map((p) => (
            <g key={p.year}>
              <rect x={sx(p.year) - 4} y={sy(p.obs) - 4} width="8" height="8" fill={OBS} stroke="#0b1120" strokeWidth="2" />
              <circle cx={sx(p.year)} cy={sy(p.model)} r="4.5" fill={MODEL} stroke="#0b1120" strokeWidth="2" />
            </g>
          ))}
          <text x={sx(last.year) + 9} y={labModel + 3} className="fill-slate-300" fontSize="10">
            Model
          </text>
          <text x={sx(last.year) + 9} y={labObs + 3} className="fill-slate-300" fontSize="10">
            ABARES
          </text>
          {/* Hit targets wider than the marks: one column per year. */}
          {pts.map((p, i) => {
            const half = (W - PAD.l - PAD.r) / Math.max(1, pts.length - 1) / 2
            return <rect key={p.year} x={sx(p.year) - half} y={PAD.t} width={half * 2} height={H - PAD.t - PAD.b} fill="transparent" onMouseEnter={() => setHover(i)} />
          })}
        </svg>
        {h && (
          <div
            className="pointer-events-none absolute top-1 rounded-lg border border-space-600 bg-space-950/95 px-2.5 py-1.5 font-mono text-[11px] text-slate-200 shadow-lg"
            style={{ left: `${(sx(h.year) / W) * 100}%`, transform: sx(h.year) > W * 0.6 ? 'translateX(calc(-100% - 8px))' : 'translateX(8px)' }}
          >
            <div className="mb-0.5 font-bold text-white">
              {h.year}–{String(h.year + 1).slice(2)} season
            </div>
            <div>
              Model <strong className="text-white">{h.model.toFixed(2)}</strong> t/{unit}
            </div>
            <div>
              ABARES <strong className="text-white">{h.obs.toFixed(2)}</strong> t/{unit}
            </div>
          </div>
        )}
      </div>

      <details className="text-[11px] text-slate-400">
        <summary className="cursor-pointer select-none hover:text-slate-200">Table view & method</summary>
        <table className="mt-2 w-full text-center font-mono">
          <thead className="text-slate-500">
            <tr>
              <th className="text-left">Season</th>
              <th>Model t/{unit}</th>
              <th>ABARES t/{unit}</th>
            </tr>
          </thead>
          <tbody className="text-slate-300">
            {pts.map((p) => (
              <tr key={p.year}>
                <td className="text-left">
                  {p.year}–{String(p.year + 1).slice(2)}
                </td>
                <td>{p.model.toFixed(2)}</td>
                <td>{p.obs.toFixed(2)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-2 leading-snug">
          Each modelled season uses that year’s own NASA weather and soil water, sown on the nominal date, with no what-if, irrigation or rotation settings.
          ABARES figures are state averages (production ÷ planted area, so failed crops count), so a single paddock will swing more than the state. Source:{' '}
          <a className="inline-flex items-center gap-0.5 text-cyan-400 hover:underline" href={ABARES_URL} target="_blank" rel="noreferrer">
            {ABARES_SOURCE} <ExternalLink className="size-3" />
          </a>
          .
        </p>
      </details>
    </Shell>
  )
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-2 rounded-xl border border-space-700 bg-space-900 p-4">
      <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
        <Scale className="size-3.5 text-cyan-400" /> Model vs reality
      </span>
      {children}
    </div>
  )
}

function niceTicks(max: number): number[] {
  const step = max <= 2 ? 0.5 : max <= 5 ? 1 : 2
  const out: number[] = []
  for (let t = 0; t <= max + 1e-9; t += step) out.push(t)
  return out
}
