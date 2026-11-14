import type { ReactNode } from 'react'
import { CircleAlert, CircleCheck, Droplet, Snowflake, Sun, Tractor } from 'lucide-react'
import type { Season } from '../data/crops'
import type { SiteSnapshot } from '../engine/model'

type Tone = 'good' | 'warn' | 'bad'

const TONE_TEXT: Record<Tone, string> = { good: 'text-emerald-400', warn: 'text-amber-400', bad: 'text-rose-400' }
const TONE_ICON_BOX: Record<Tone, string> = {
  good: 'border-emerald-500/40 bg-emerald-500/20',
  warn: 'border-amber-500/40 bg-amber-500/20',
  bad: 'border-rose-500/40 bg-rose-500/20',
}

/** Plain-language paddock readiness for Farmer Mode: same NASA numbers as the telemetry panel,
 *  turned into a traffic light and three simple checks. */
export function FarmerReadinessPanel({ snap, season }: { snap: SiteSnapshot; season: Season }) {
  const pct = snap.bucketFraction !== null ? Math.round(snap.bucketFraction * 100) : null

  let overall: { tone: Tone; title: string; desc: string; tank: string }
  if (pct === null)
    overall = { tone: 'warn', title: 'Soil moisture unknown', desc: 'NASA hasn’t published recent root-zone moisture for this spot yet.', tank: 'No data' }
  else if (pct < 30)
    overall = {
      tone: 'bad',
      title: 'Caution: low subsoil moisture',
      desc: 'The deep soil water tank is low. Stick to drought-tolerant pulses or sorghum, or plan to irrigate.',
      tank: 'Low (water deficit)',
    }
  else if (pct >= 50)
    overall = { tone: 'good', title: 'Great sowing conditions', desc: 'The paddock’s water tank is well filled, a strong start for high-yield grains and oilseeds.', tank: 'Full (high moisture)' }
  else
    overall = { tone: 'good', title: 'Good conditions to plant', desc: 'The subsoil water tank is about half full, enough for germination and deep root growth.', tank: 'Half full (ready)' }

  const frost: { tone: Tone; text: string } =
    snap.seasonFrostDays <= 2 ? { tone: 'good', text: 'Low threat' } : snap.seasonFrostDays <= 10 ? { tone: 'warn', text: 'Some frost nights' } : { tone: 'bad', text: 'Frequent frost' }
  const heat: { tone: Tone; text: string } =
    snap.seasonHotDays <= 5 ? { tone: 'good', text: 'Mild season' } : snap.seasonHotDays <= 25 ? { tone: 'warn', text: 'Some hot spells' } : { tone: 'bad', text: 'Very hot season' }
  const rainRatio = snap.rain90NormalMm ? snap.rain90Mm / snap.rain90NormalMm : null
  const rain: { tone: Tone; text: string } =
    rainRatio === null
      ? { tone: 'warn', text: `${Math.round(snap.rain90Mm)} mm (90 d)` }
      : rainRatio >= 0.85
        ? { tone: 'good', text: rainRatio >= 1.2 ? 'Wetter than normal' : 'About normal' }
        : rainRatio >= 0.6
          ? { tone: 'warn', text: 'Below normal' }
          : { tone: 'bad', text: 'Well below normal' }

  const card =
    overall.tone === 'bad' ? 'border-rose-500/40 from-rose-950/60' : overall.tone === 'warn' ? 'border-amber-500/40 from-amber-950/50' : 'border-emerald-500/40 from-emerald-950/60'

  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <Tractor className="size-4 text-emerald-400" /> 2. Paddock Readiness
        </h3>
        <span className="flex items-center gap-1 rounded-full border border-emerald-800 bg-emerald-950 px-2.5 py-0.5 text-[11px] font-semibold text-emerald-400">
          <span className="size-2 animate-pulse rounded-full bg-emerald-400" /> Farmer view
        </span>
      </div>

      <div className={`flex items-center gap-4 rounded-xl border bg-gradient-to-r to-space-900 p-4 ${card}`}>
        <div className={`flex size-12 shrink-0 items-center justify-center rounded-xl border ${TONE_ICON_BOX[overall.tone]}`}>
          {overall.tone === 'good' ? <CircleCheck className="size-7 text-emerald-400" /> : <CircleAlert className={`size-7 ${TONE_TEXT[overall.tone]}`} />}
        </div>
        <div>
          <span className="block text-sm font-bold text-white">{overall.title}</span>
          <p className="mt-0.5 text-xs leading-snug text-slate-300">{overall.desc}</p>
        </div>
      </div>

      <div className="flex items-center gap-4 rounded-xl border border-space-700 bg-space-900 p-3.5">
        <div className="relative flex h-16 w-14 shrink-0 flex-col justify-end overflow-hidden rounded-lg border-2 border-space-600 bg-space-800 p-1">
          <div className="w-full rounded-b bg-gradient-to-t from-cyan-600 to-blue-400 transition-all duration-700" style={{ height: `${pct ?? 0}%` }} />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-200">Subsoil water tank</span>
            <span className={`font-mono text-xs font-semibold ${TONE_TEXT[overall.tone]}`}>{overall.tank}</span>
          </div>
          <p className="mt-1 text-xs leading-snug text-slate-400">Deep soil moisture is your drought reserve. It carries the crop through dry spells.</p>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-xs">
        <Check icon={<Snowflake className="size-3.5" />} label="Frost" tone={frost.tone} text={frost.text} />
        <Check icon={<Sun className="size-3.5" />} label="Heat" tone={heat.tone} text={heat.text} />
        <Check icon={<Droplet className="size-3.5" />} label="Recent rain" tone={rain.tone} text={rain.text} />
      </div>
      <p className="text-center text-[10px] text-slate-500">
        Frost & heat: typical {season === 'winter' ? 'May–Oct' : 'Oct–Mar'} season from past NASA weather · Rain: last 90 days vs the same 90 days in past years
      </p>

      <p className="text-center text-[11px] italic text-slate-500">
        Switch to <strong className="text-cyan-400">NASA Telemetry Mode</strong> (top right) to see the raw satellite numbers and formulas.
      </p>
    </section>
  )
}

function Check({ icon, label, tone, text }: { icon: ReactNode; label: string; tone: Tone; text: string }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-900 p-2.5">
      <span className={`mb-0.5 flex items-center justify-center gap-1 font-bold ${TONE_TEXT[tone]}`}>
        {icon} {label}
      </span>
      <span className="text-[10px] text-slate-400">{text}</span>
    </div>
  )
}
