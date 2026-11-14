import { CalendarCheck, ChartLine, Crown, Hourglass, Leaf, Snowflake, Sprout, Thermometer, TriangleAlert, Weight, Wheat } from 'lucide-react'
import { formatNitrogen } from '../data/crops'
import type { CropResult } from '../engine/model'
import { aud, longDate } from './format'

export function WinnerBanner({ winner, placeName, bucketPct }: { winner: CropResult; placeName: string; bucketPct: number | null }) {
  const c = winner.crop
  return (
    <section className="relative overflow-hidden rounded-2xl border-2 border-emerald-500/50 bg-gradient-to-r from-emerald-900/70 via-emerald-800/50 to-space-800 p-5 shadow-2xl">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <span className="flex items-center gap-1 rounded-full bg-amber-400 px-2.5 py-0.5 text-[11px] font-bold text-space-900 shadow">
              <Crown className="size-3" /> TOP INVESTMENT PICK
            </span>
            <span className="text-xs font-semibold text-emerald-300">Top ranked for {placeName}</span>
          </div>
          <h3 className="text-2xl font-black tracking-tight text-white">
            {c.name} <span className="text-base font-semibold text-emerald-200">({c.category})</span>
          </h3>
          <p className="mt-1 max-w-xl text-xs text-slate-300">
            Starting from a <strong>{bucketPct ?? '–'}% subsoil bucket</strong> and replayed across <strong>{winner.years.length} past seasons</strong> of NASA
            weather, {c.name} {winner.daysToHarvest !== null ? <>finishes in <strong>{winner.daysToHarvest} days</strong></> : <>does not reliably mature</>}, lost money in{' '}
            <strong>{Math.round(winner.lossProbability * 100)}%</strong> of seasons, and leaves <strong>{formatNitrogen(c.nitrogenKgHa)}</strong>.
          </p>
        </div>
        <div className="shrink-0 rounded-xl border border-emerald-500/30 bg-space-900/60 p-3 sm:text-right">
          <span className="block text-[10px] font-bold uppercase text-slate-400">Expected net profit</span>
          <span className={`font-mono text-2xl font-black ${winner.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{aud(winner.netProfit, true)}</span>
          <span className="block font-mono text-xs text-slate-300">ROI {winner.roiPct}% · score {winner.score}</span>
        </div>
      </div>
    </section>
  )
}

export function Leaderboard({ results, activeId, onSelect, scientist }: { results: CropResult[]; activeId: string; onSelect: (id: string) => void; scientist: boolean }) {
  return (
    <section className="space-y-4 rounded-2xl border border-space-700 bg-space-800 p-5 shadow-lg">
      <div className="flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <ChartLine className="size-4 text-emerald-400" /> 3. Season Investment Leaderboard
        </h2>
        <span className="text-xs text-slate-400">Ranked by risk-adjusted return</span>
      </div>
      <div className="space-y-3">
        {results.map((r, idx) => {
          const selected = r.crop.id === activeId
          const badge =
            r.score < 40 ? 'bg-rose-500/20 text-rose-300 border-rose-500/40' : r.score < 65 ? 'bg-amber-500/20 text-amber-300 border-amber-500/40' : 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
          return (
            <button
              key={r.crop.id}
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
                    {r.offSeason && <span className="rounded border border-slate-600 px-1.5 py-0.5 text-[10px] text-slate-400">off-season</span>}
                  </div>
                  <div className="mt-0.5 flex flex-wrap items-center gap-3 font-mono text-[11px] text-slate-400">
                    <span className="flex items-center gap-1">
                      <Hourglass className="size-3 text-amber-400" />
                      {r.daysToHarvest !== null ? `${r.daysToHarvest} days` : 'won’t mature'}
                    </span>
                    <span className="flex items-center gap-1">
                      <Weight className="size-3 text-cyan-400" />
                      {r.yieldAc.toFixed(2)} t/ac
                    </span>
                    <span className={r.lossProbability > 0.3 ? 'text-rose-300' : ''}>loss risk {Math.round(r.lossProbability * 100)}%</span>
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
                      </>
                    )}
                  </div>
                </div>
              </div>
              <div className="shrink-0 sm:text-right">
                <span className={`font-mono text-base font-black ${r.netProfit >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{aud(r.netProfit, true)}</span>
                <span className="block font-mono text-[10px] text-slate-400">ROI {r.roiPct}%</span>
              </div>
            </button>
          )
        })}
      </div>
    </section>
  )
}

export function DeepDive({ r, acres, scientist }: { r: CropResult; acres: number; scientist: boolean }) {
  const c = r.crop
  const ph = r.phaseDays
  const total = ph ? ph.vegetative + ph.flowering + ph.ripening : 1
  const yieldLossPct = Math.round((1 - r.yieldAc / c.baseYieldAc) * 100)

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
          <div className="flex h-4 w-full overflow-hidden rounded-full border border-space-700 bg-space-800 text-[9px] font-bold">
            <div className="flex items-center justify-center bg-emerald-600 text-white" style={{ width: `${(ph.vegetative / total) * 100}%` }}>
              Vegetative {ph.vegetative}d
            </div>
            <div className="flex items-center justify-center bg-cyan-600 text-white" style={{ width: `${(ph.flowering / total) * 100}%` }}>
              Flowering {ph.flowering}d
            </div>
            <div className="flex items-center justify-center bg-amber-500 text-space-900" style={{ width: `${(ph.ripening / total) * 100}%` }}>
              Ripening {ph.ripening}d
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
          {r.avgWaterRatio < 0.8 ? (
            <span className="font-bold text-rose-400">⚠ Water deficit — expected yield {yieldLossPct}% below potential.</span>
          ) : (
            <span className="font-bold text-emerald-400">✓ Stored + in-season water adequate for grain fill.</span>
          )}{' '}
          {r.avgHeatDays >= 3 && <span className="font-bold text-amber-300">🔥 ~{r.avgHeatDays.toFixed(0)} heat-stress days (&gt;{c.heatThresholdC}°C) at flowering.</span>}{' '}
          {r.avgFrostDays >= 1 && <span className="font-bold text-sky-300">❄ ~{r.avgFrostDays.toFixed(1)} frost days at flowering.</span>}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 text-center sm:grid-cols-4">
        <Fin label="Expected yield" value={`${r.yieldAc.toFixed(2)} t/ac`} sub={`${Math.round(r.totalTonnes).toLocaleString()} t total`} cls="text-white" />
        <Fin label="Gross revenue" value={aud(r.grossRevenue)} sub={`@ $${c.priceAudPerT}/t`} cls="text-cyan-400" />
        <Fin label="Total costs" value={aud(r.totalCosts)} sub={`$${c.costAudPerAc} / acre`} cls="text-rose-400" />
        <Fin
          label="Net profit"
          value={aud(r.netProfit, true)}
          sub={`${r.roiPct}% ROI (${aud(r.netProfit / acres)}/ac)`}
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
          <span className="text-slate-300">Worst past season</span>
          <span className={`font-mono font-bold ${r.worstProfit >= 0 ? 'text-emerald-300' : 'text-rose-300'}`}>{aud(r.worstProfit, true)}</span>
        </div>
      </div>

      {scientist && (
        <div className="overflow-x-auto rounded-lg border border-space-700 bg-space-950 p-3">
          <p className="mb-2 font-mono text-xs font-bold text-emerald-400">// Analogue-season replay (NASA POWER daily weather)</p>
          <table className="w-full font-mono text-[11px] text-slate-300">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left">Sown</th>
                <th>Days</th>
                <th>Rain mm</th>
                <th>Water ratio</th>
                <th>Heat d</th>
                <th>Frost d</th>
                <th>Yield ×</th>
                <th className="text-right">Profit</th>
              </tr>
            </thead>
            <tbody>
              {r.years.map((y) => (
                <tr key={y.sowYear} className="text-center">
                  <td className="text-left">{y.sowYear}</td>
                  <td>{y.days ?? '—'}</td>
                  <td>{Math.round(y.rainMm)}</td>
                  <td>{y.waterRatio.toFixed(2)}</td>
                  <td>{y.heatDays}</td>
                  <td>{y.frostDays}</td>
                  <td>{y.yieldFactor.toFixed(2)}</td>
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
