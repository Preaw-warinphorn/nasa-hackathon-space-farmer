import type { ReactNode } from 'react'
import { CalendarCheck, ChartLine, ChartPie, Check, Crown, Flame, Hourglass, Leaf, ShieldHalf, Snowflake, Sprout, Thermometer, TriangleAlert, Weight, Wheat } from 'lucide-react'
import { formatNitrogen } from '../data/crops'
import { BACKTEST } from '../data/validation'
import type { CropResult } from '../engine/model'
import { aud, longDate } from './format'
import type { AreaUnit } from './units'
import { fmtArea, fmtPerArea, fmtYield } from './units'

export interface OtherWindow {
  label: string
  sowDate: Date
  best: CropResult
  onSwitch: () => void
}

export function WinnerBanner({ winner, placeName, other, areaHa, unit }: { winner: CropResult; placeName: string; other: OtherWindow | null; areaHa: number; unit: AreaUnit }) {
  const c = winner.crop
  if (winner.netProfit < 0) return <NoProfitBanner winner={winner} placeName={placeName} other={other} areaHa={areaHa} unit={unit} />
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-900/70 via-emerald-800/50 to-space-800 p-5 shadow-2xl">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-space-900 shadow">
              <Crown className="size-3" /> TOP CROP PICK
            </span>
            <span className="text-xs font-semibold text-emerald-300">Top ranked for {placeName}</span>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            {c.name} <span className="text-base font-semibold text-emerald-200">({c.category})</span>
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-300">
            Replayed across <strong>{winner.years.length} past seasons</strong> of NASA weather
            {winner.startWaterSource === 'today' ? <> from today’s measured soil water</> : <>, each from that year’s own soil water</>}, {c.name} {winner.daysToHarvest !== null ? <>finishes in <strong>{winner.daysToHarvest} days</strong></> : <>does not reliably mature</>}, lost money in{' '}
            <strong>{Math.round(winner.lossProbability * 100)}%</strong> of seasons, and leaves <strong>{formatNitrogen(c.nitrogenKgHa)}</strong>.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-space-900/60 p-3 sm:text-right">
          <span className="block text-[10px] font-bold uppercase text-slate-400">Expected gross margin</span>
          <span className={`font-mono text-2xl font-black ${winner.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{aud(winner.netProfit, true)}</span>
          <span className="block font-mono text-xs text-slate-300">
            {winner.roiPct}% return on growing costs · score {winner.score}
          </span>
          <span className="block font-mono text-[10px] text-slate-400" title={`Back-test ${BACKTEST.period}: typical gap between forecast and actual margin for one crop in one season`}>
            typical miss ±{fmtPerArea(BACKTEST.forecastMaeAudHa, unit)} in any one season
          </span>
        </div>
      </div>
      <p className="mt-3 text-[10px] text-emerald-100/60">Indicative planning tool based on past seasons. Not financial advice: check prices, costs and local agronomy before you commit.</p>
    </section>
  )
}

/** Shown when even the best in-season crop is expected to lose money: say so plainly. */
function NoProfitBanner({ winner, placeName, other, areaHa, unit }: { winner: CropResult; placeName: string; other: OtherWindow | null; areaHa: number; unit: AreaUnit }) {
  const otherPays = other && other.best.netProfit > 0 && !other.best.notRecommended
  return (
    <section className="rounded-2xl border-2 border-amber-500/50 bg-gradient-to-r from-amber-950/60 via-space-800 to-space-800 p-5 shadow-2xl">
      <div className="mb-1 flex flex-wrap items-center gap-2">
        <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-space-900 shadow">
          <TriangleAlert className="size-3" /> NO CROP EXPECTED TO PAY
        </span>
        <span className="text-xs font-semibold text-amber-200">{placeName}</span>
      </div>
      <h3 className="text-xl font-black tracking-tight text-white">Planting now is likely to lose money</h3>
      <p className="mt-1 max-w-3xl text-xs text-slate-300">
        {winner.startWaterSource === 'today' ? (
          <>
            NASA soil moisture says the profile is at <strong>{Math.round(winner.avgStartWaterMm)} mm</strong> of plant-available water today.
          </>
        ) : (
          <>Stored soil water at sowing averages {Math.round(winner.avgStartWaterMm)} mm in past seasons.</>
        )}{' '}
        Even the least-bad option, <strong>{winner.crop.name}</strong>, lost money in <strong>{Math.round(winner.lossProbability * 100)}%</strong> of past seasons (expected{' '}
        {fmtPerArea(winner.netProfit / areaHa, unit, true)}).
      </p>
      {otherPays && other ? (
        <div className="mt-3 flex flex-col items-start justify-between gap-3 rounded-xl border border-emerald-500/40 bg-emerald-950/40 p-3 sm:flex-row sm:items-center">
          <p className="text-xs text-emerald-100">
            Better bet: wait for the <strong>{other.label.toLowerCase()}</strong> window (sow {longDate(other.sowDate)}) and grow <strong>{other.best.crop.name}</strong>, with an expected{' '}
            <strong>{fmtPerArea(other.best.netProfit / areaHa, unit, true)}</strong> and losses in {Math.round(other.best.lossProbability * 100)}% of past seasons.
          </p>
          <button onClick={other.onSwitch} className="shrink-0 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500">
            Show {other.label.toLowerCase()} plan
          </button>
        </div>
      ) : (
        <p className="mt-2 text-xs text-amber-200">Consider fallowing to store rain, or irrigating, and check again after the next good fall.</p>
      )}
      <p className="mt-3 text-[10px] text-slate-400">Indicative planning tool based on past seasons. Not financial advice.</p>
    </section>
  )
}

function StressBadge({ rainAnomalyPct, tempAnomalyC }: { rainAnomalyPct: number; tempAnomalyC: number }) {
  if (rainAnomalyPct <= -25)
    return (
      <span className="flex items-center gap-1 rounded-md border border-rose-700/60 bg-rose-950/60 px-2.5 py-1 font-semibold text-rose-300">
        <TriangleAlert className="size-3 text-rose-400" /> El Niño shock ({rainAnomalyPct}%)
      </span>
    )
  if (tempAnomalyC >= 2.5)
    return (
      <span className="flex items-center gap-1 rounded-md border border-amber-700/60 bg-amber-950/60 px-2.5 py-1 font-semibold text-amber-300">
        <Flame className="size-3 text-amber-400" /> Extreme heatwave (+{tempAnomalyC.toFixed(1)}°C)
      </span>
    )
  if (rainAnomalyPct !== 0 || tempAnomalyC !== 0)
    return <span className="rounded-md border border-cyan-700/60 bg-space-900 px-2.5 py-1 font-semibold text-cyan-300">What-if scenario active</span>
  return (
    <span className="flex items-center gap-1 rounded-md border border-space-600 bg-space-900 px-2.5 py-1 font-semibold text-cyan-300">
      <Check className="size-3 text-emerald-400" /> Baseline climate
    </span>
  )
}

export function Leaderboard({
  results,
  activeId,
  onSelect,
  scientist,
  placeName,
  areaHa,
  unit,
  rainAnomalyPct,
  tempAnomalyC,
}: {
  results: CropResult[]
  activeId: string
  onSelect: (id: string) => void
  scientist: boolean
  placeName: string
  areaHa: number
  unit: AreaUnit
  rainAnomalyPct: number
  tempAnomalyC: number
}) {
  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex flex-col justify-between gap-2 border-b border-space-700 pb-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
            <ChartLine className="size-4 text-emerald-400" /> Season Investment Leaderboard
          </h2>
          <p className="mt-0.5 font-mono text-xs text-slate-400">
            📍 {placeName} · {fmtArea(areaHa, unit)} · temp +{tempAnomalyC.toFixed(1)}°C · rain {rainAnomalyPct > 0 ? '+' : ''}
            {rainAnomalyPct}% · ranked by expected margin per {unit}, less a loss-risk penalty
          </p>
        </div>
        <div className="self-start font-mono text-[11px] sm:self-auto">
          <StressBadge rainAnomalyPct={rainAnomalyPct} tempAnomalyC={tempAnomalyC} />
        </div>
      </div>
      <div className="space-y-3">
        {results.map((r, idx) => {
          const selected = r.crop.id === activeId
          const badge =
            r.score < 40 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : r.score < 65 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          const firstOffSeason = r.notRecommended && (idx === 0 || !results[idx - 1].notRecommended)
          return (
            <div key={r.crop.id}>
            {firstOffSeason && (
              <p className="mb-3 mt-1 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <span className="h-px flex-1 bg-space-600" /> Not recommended: off-season or not grown in this region <span className="h-px flex-1 bg-space-600" />
              </p>
            )}
            <button
              onClick={() => onSelect(r.crop.id)}
              className={`flex w-full flex-col items-start justify-between gap-3 rounded-xl border p-3.5 text-left transition-all sm:flex-row sm:items-center ${
                selected ? 'border-emerald-400/80 bg-space-900 shadow-md ring-1 ring-emerald-400/50' : 'border-space-700 bg-space-900/60 hover:bg-space-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <span className="text-2xl">{r.crop.icon}</span>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h4 className="text-sm font-bold text-white">{r.crop.name}</h4>
                    {idx === 0 && <span className="rounded bg-amber-400 px-1.5 py-0.5 text-[10px] font-bold text-space-900">#1 PICK</span>}
                    <span className={`rounded border px-2 py-0.5 font-mono text-[10px] font-bold ${badge}`}>{r.score} pts</span>
                    {r.notSuited && (
                      <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400" title="Dryland sorghum and mungbeans are grown in the summer-rainfall zone north of ~33°S">
                        not grown here
                      </span>
                    )}
                    {r.offSeason && <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400">off-season</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Hourglass className="size-3 text-amber-400" />
                      {r.daysToHarvest !== null ? `${r.daysToHarvest} days` : 'won’t mature'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="size-3 text-cyan-400" />
                      {fmtYield(r.yieldTHa, unit)}
                    </span>
                    <span className={r.lossProbability > 0.3 ? 'text-rose-300' : ''}>loss risk {Math.round(r.lossProbability * 100)}%</span>
                    {r.coldFailShare > 0 && (
                      <span className="flex items-center gap-1 text-sky-300" title="Frost-tender crop: fails if sown into cold soil (needs ~16 °C and rising) or hit by frost at any stage">
                        <Snowflake className="size-3" />
                        {r.coldFailShare === 1 ? 'too cold: fails every season' : `cold/frost kills ${Math.round(r.coldFailShare * 100)}% of seasons`}
                      </span>
                    )}
                    {r.heatFailShare > 0 && (
                      <span className="flex items-center gap-1 text-orange-300" title="Flowers through a heatwave: when most flowering days are above the crop's heat limit, grain set fails">
                        <Flame className="size-3" />
                        {r.heatFailShare === 1 ? 'too hot: fails every season' : `heat blast kills ${Math.round(r.heatFailShare * 100)}% of seasons`}
                      </span>
                    )}
                    <span className={r.crop.nitrogenKgHa > 0 ? 'font-semibold text-emerald-300' : ''}>{formatNitrogen(r.crop.nitrogenKgHa)}</span>
                    {r.rotation.tone !== 'neutral' && (
                      <span className={r.rotation.tone === 'good' ? 'text-emerald-300' : 'text-rose-300'}>
                        rotation {r.rotation.yieldMult > 1 ? '+' : ''}
                        {Math.round((r.rotation.yieldMult - 1) * 100)}%
                      </span>
                    )}
                    {scientist && (
                      <>
                        <span className="flex items-center gap-1">
                          <Thermometer className="size-3 text-rose-400" />
                          {r.avgHeatDays.toFixed(1)} heat d
                        </span>
                        <span className="flex items-center gap-1">
                          <Snowflake className="size-3 text-sky-300" />
                          {r.avgFrostDays.toFixed(1)} frost d
                        </span>
                        <span>water ratio {r.avgWaterRatio.toFixed(2)}</span>
                        <span>start water {Math.round(r.avgStartWaterMm)} mm</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <span className={`font-mono text-base font-black ${r.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{aud(r.netProfit, true)}</span>
                <span className="block font-mono text-[10px] text-slate-400">
                  {fmtPerArea(r.netProfit / areaHa, unit, true)} · {r.roiPct}% return
                </span>
              </div>
            </button>
            </div>
          )
        })}
      </div>
    </section>
  )
}

export function DeepDive({ r, areaHa, unit, scientist, children }: { r: CropResult; areaHa: number; unit: AreaUnit; scientist: boolean; children?: ReactNode }) {
  const c = r.crop
  const ph = r.phaseDays
  const total = ph ? ph.vegetative + ph.flowering + ph.ripening : 1

  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <CalendarCheck className="size-4 text-cyan-400" /> Harvest Timeline & Financials
        </h3>
        <span className="font-mono text-xs font-bold text-emerald-400">{c.name}</span>
      </div>

      <div className="space-y-3 rounded-xl border border-space-700 bg-space-900 p-4">
        <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
          <span className="flex items-center gap-1.5 text-slate-300">
            <Sprout className="size-3.5 text-emerald-400" /> Sowing: <strong className="text-white">{longDate(r.sowDate)}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Hourglass className="size-3.5 text-amber-400" /> Output window:{' '}
            <strong className="text-amber-300">{r.daysToHarvest !== null ? `${r.daysToHarvest} days (${(r.daysToHarvest / 30.4).toFixed(1)} mo)` : '—'}</strong>
          </span>
          <span className="flex items-center gap-1.5 text-slate-300">
            <Wheat className="size-3.5 text-emerald-400" /> Harvest: <strong className="text-emerald-400">{r.harvestDate ? longDate(r.harvestDate) : 'Does not mature'}</strong>
          </span>
        </div>

        {ph ? (
          <div className="space-y-1.5">
            <div className="flex h-3 w-full overflow-hidden rounded-full border border-space-700 bg-space-800" aria-hidden>
              <div className="bg-emerald-600" style={{ width: `${(ph.vegetative / total) * 100}%` }} />
              <div className="bg-cyan-600" style={{ width: `${(ph.flowering / total) * 100}%` }} />
              <div className="bg-amber-500" style={{ width: `${(ph.ripening / total) * 100}%` }} />
            </div>
            {/* Labels live outside the bar: short phases (often ripening) are too narrow to hold text. */}
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-300">
              {[
                ['bg-emerald-600', 'Vegetative', ph.vegetative],
                ['bg-cyan-600', 'Flowering', ph.flowering],
                ['bg-amber-500', 'Ripening', ph.ripening],
              ].map(([cls, label, days]) => (
                <span key={label} className="flex items-center gap-1.5">
                  <span className={`size-2.5 rounded-sm ${cls}`} />
                  {label} <strong className="font-mono text-white">{days}d</strong>
                </span>
              ))}
            </div>
          </div>
        ) : (
          <p className="flex items-center gap-1.5 text-xs font-semibold text-rose-300">
            <TriangleAlert className="size-4" /> Not enough thermal time to reach maturity within 240 days in most past seasons.
          </p>
        )}

        <p className="text-[11px] leading-snug text-slate-400">
          Thermal model: {c.targetGdd.toLocaleString()}°C·d needed above {c.tBase}°C base
          {r.matureShare < 1 && r.matureShare > 0 && <> — matured in only {Math.round(r.matureShare * 100)}% of past seasons</>}.{' '}
          {r.waterLimitedShare >= 0.5 ? (
            <span className="font-bold text-amber-300">
              💧 Water-limited in {Math.round(r.waterLimitedShare * 100)}% of past seasons (avg {Math.round(r.avgStartWaterMm)} mm soil water at sowing + {Math.round(r.avgRainMm)} mm
              rain).
            </span>
          ) : (
            <span className="font-bold text-emerald-400">✓ Usually enough water: sunlight, not water, sets the yield in most seasons.</span>
          )}{' '}
          {r.avgHeatDays >= 3 && <span className="font-bold text-amber-300">🔥 ~{r.avgHeatDays.toFixed(0)} heat-stress days (&gt;{c.heatThresholdC}°C) at flowering.</span>}{' '}
          {r.avgFrostDays >= 1 && <span className="font-bold text-sky-300">❄ ~{r.avgFrostDays.toFixed(1)} frost days at flowering.</span>}
        </p>
      </div>

      {scientist ? <YieldCuts r={r} unit={unit} /> : <ResilienceCard r={r} />}

      {children}

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <Fin label="Expected yield" value={fmtYield(r.yieldTHa, unit)} sub={`${Math.round(r.totalTonnes).toLocaleString()} t total`} cls="text-white" />
        <Fin label="Gross revenue" value={aud(r.grossRevenue)} sub={`@ $${Math.round(r.priceAudPerT)}/t farm-gate`} cls="text-cyan-400" />
        <Fin
          label="Growing costs"
          value={aud(r.totalCosts)}
          sub={`${fmtPerArea(r.totalCosts / areaHa, unit)}${r.irrigationCost > 0 ? ` incl. ${aud(r.irrigationCost)} water` : ''}`}
          cls="text-rose-400"
        />
        <Fin
          label="Gross margin"
          value={aud(r.netProfit, true)}
          sub={`${fmtPerArea(r.netProfit / areaHa, unit, true)} · ${r.roiPct}% return · ±${fmtPerArea(BACKTEST.forecastMaeAudHa, unit)} typical miss`}
          cls={r.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}
          highlight
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="flex items-center justify-between rounded-xl border border-emerald-800/40 bg-emerald-950/40 p-3 text-xs">
          <span className="flex items-center gap-2 text-slate-300">
            <Leaf className="size-4 text-emerald-400" /> Next-season soil nitrogen
          </span>
          <span className="font-mono font-bold text-emerald-300">{formatNitrogen(c.nitrogenKgHa)}</span>
        </div>
        <div className="flex items-center justify-between rounded-xl border border-rose-900/40 bg-rose-950/30 p-3 text-xs">
          <span className="text-slate-300">Worst past season ({Math.round(r.lossProbability * 100)}% lost money)</span>
          <span className={`font-mono font-bold ${r.worstProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{aud(r.worstProfit, true)}</span>
        </div>
      </div>

      {scientist && (
        <div className="overflow-x-auto rounded-lg border border-space-700 bg-space-950 p-3">
          <p className="mb-2 font-mono text-xs font-bold text-emerald-400">// Analogue-season replay (NASA POWER daily weather) · Water = WUE × (soil + rain − E) · Sun = solar × RUE × HI</p>
          <table className="w-full font-mono text-[11px] text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left">Sown</th>
                <th>Days</th>
                <th>Soil mm</th>
                <th>Rain mm</th>
                <th>Water t/ha</th>
                <th>Sun t/ha</th>
                <th>Heat d</th>
                <th>Frost d</th>
                <th>Yield t/ha</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {r.years.map((y) => (
                <tr key={y.sowYear} className="text-center">
                  <td className="text-left">{y.sowYear}</td>
                  <td>{y.days ?? '—'}</td>
                  <td>{Math.round(y.startWaterMm)}</td>
                  <td>{Math.round(y.rainMm)}</td>
                  <td>{y.waterLimitedTHa.toFixed(2)}</td>
                  <td>{y.radiationLimitedTHa.toFixed(2)}</td>
                  <td>{y.heatDays}</td>
                  <td>{y.frostDays}</td>
                  <td>{y.yieldTHa.toFixed(2)}</td>
                  <td className={`text-right ${y.profit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{aud(y.profit, true)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

function Fin({ label, value, sub, cls, highlight }: { label: string; value: string; sub: string; cls: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border bg-space-900 p-3 ${highlight ? 'border-emerald-500/30' : 'border-space-700'}`}>
      <span className="block text-[10px] font-semibold uppercase text-slate-400">{label}</span>
      <span className={`font-mono text-base font-bold ${cls}`}>{value}</span>
      <span className="block font-mono text-[10px] text-slate-400">{sub}</span>
    </div>
  )
}

function droughtLabel(t: number): string {
  if (t >= 0.85) return 'Very strong'
  if (t >= 0.75) return 'High'
  if (t >= 0.6) return 'Moderate'
  return 'Sensitive (needs moisture)'
}

/** Farmer Mode: qualitative strengths of the selected crop, derived from the same replay numbers. */
function ResilienceCard({ r }: { r: CropResult }) {
  const c = r.crop
  const hot = r.avgHeatDays >= 2
  const cold = r.avgFrostDays >= 1
  const weather = hot && cold ? 'Heat & frost risk' : hot ? 'Heat-sensitive at flowering' : cold ? 'Frost-prone at flowering' : 'Safe weather window'
  const soil = c.nitrogenKgHa > 0 ? `Fixes ~${c.nitrogenKgHa} kg/ha free N` : c.nitrogenKgHa === 0 ? 'Nitrogen neutral' : 'Uses soil nitrogen'
  const rotCls =
    r.rotation.tone === 'good'
      ? 'border-emerald-500/40 bg-emerald-950/40 text-emerald-300'
      : r.rotation.tone === 'bad'
        ? 'border-rose-500/40 bg-rose-950/40 text-rose-300'
        : 'border-space-700 bg-space-900/60 text-slate-300'
  return (
    <div className="space-y-3 rounded-xl border border-space-700 bg-space-900/80 p-4">
      <div className="flex items-center justify-between border-b border-space-700 pb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
          <ShieldHalf className="size-3.5 text-emerald-400" /> Crop Resilience & Rotation Fit
        </span>
        <span className="rounded border border-emerald-800 bg-emerald-950 px-2 py-0.5 text-[10px] font-semibold text-emerald-400">Farmer view</span>
      </div>
      <div className="grid grid-cols-3 items-stretch gap-2.5 text-center text-xs">
        <Badge label="Drought tolerance" value={droughtLabel(c.droughtTolerance)} ok={c.droughtTolerance >= 0.6} />
        <Badge label="Weather safety" value={weather} ok={!hot && !cold} />
        <Badge label="Soil nutrition" value={soil} ok={c.nitrogenKgHa >= 0} />
      </div>
      <div className={`flex items-center gap-2 rounded-lg border p-2.5 text-xs ${rotCls}`}>
        <Sprout className="size-4 shrink-0" />
        <span>{r.rotation.note}</span>
      </div>
    </div>
  )
}

function Badge({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-space-700 bg-space-800/80 p-2.5">
      <span className="mb-1 block text-[10px] text-slate-400">{label}</span>
      <span className={`block text-xs font-bold ${ok ? 'text-emerald-400' : 'text-amber-300'}`}>{value}</span>
    </div>
  )
}

/** NASA Telemetry Mode: which limit sets the yield, season-averaged. */
function YieldCuts({ r, unit }: { r: CropResult; unit: AreaUnit }) {
  const tile = (label: string, value: string, sub: string, title: string) => (
    <div className="rounded-lg border border-space-700 bg-space-800/80 p-2" title={title}>
      <span className="block truncate text-[10px] text-slate-400">{label}</span>
      <span className="mt-0.5 block font-mono text-xs font-bold text-white">{value}</span>
      <span className="block truncate font-mono text-[9px] text-slate-500">{sub}</span>
    </div>
  )
  return (
    <div className="space-y-3 rounded-xl border border-cyan-500/30 bg-space-900/90 p-4">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-space-700 pb-2">
        <span className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-slate-200">
          <ChartPie className="size-3.5 text-cyan-400" /> What limits the yield (season averages)
        </span>
        <span className="rounded border border-space-700 bg-space-800 px-2 py-0.5 font-mono text-[10px] text-cyan-300">
          Yield = min(water, sun) × heat/frost × rotation
        </span>
      </div>
      <div className="grid grid-cols-2 gap-2 text-center text-xs sm:grid-cols-4">
        {tile('Water-limited', fmtYield(r.avgWaterLimitedTHa, unit), `WUE ${r.crop.wueKgHaMm} kg/ha/mm`, 'French–Schultz: WUE × (soil water + rain + irrigation − evaporation)')}
        {tile('Sunlight-limited', fmtYield(r.avgRadiationLimitedTHa, unit), `RUE ${r.crop.rueGPerMj} · HI ${r.crop.harvestIndex}`, 'Season solar radiation × interception × RUE × harvest index')}
        {tile('Heat & frost', `× ${r.avgStressFactor.toFixed(2)}`, `${r.avgHeatDays.toFixed(1)} hot · ${r.avgFrostDays.toFixed(1)} frost d`, 'Damage from hot/frosty days during flowering & grain fill')}
        {tile('Rotation', `× ${r.rotation.yieldMult.toFixed(2)}`, r.rotation.tone === 'neutral' ? 'no effect' : r.rotation.tone === 'good' ? 'boost' : 'penalty', r.rotation.note)}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-space-800 bg-space-950 p-2.5 font-mono text-[11px] text-slate-300">
        <span>
          <span className="text-slate-500">Expected:</span> <strong className="text-white">{fmtYield(r.yieldTHa, unit)}</strong> · water-limited in{' '}
          {Math.round(r.waterLimitedShare * 100)}% of seasons · matured in {Math.round(r.matureShare * 100)}%
          {r.abaresFactor !== 1 && (
            <span title="Local correction towards ABARES state-average yields (square-rooted, limited to ×0.8–1.5)"> · ABARES correction ×{r.abaresFactor.toFixed(2)}</span>
          )}
        </span>
        <span className="text-[10px] text-slate-400">
          Irrigation cost: <span className="font-bold text-cyan-300">{aud(r.irrigationCost)}</span>
        </span>
      </div>
    </div>
  )
}
