import { ChevronDown, ExternalLink, Receipt, RotateCcw } from 'lucide-react'
import type { Crop } from '../data/crops'
import { FREIGHT_HANDLING_AUD_PER_T, PRICE_DATE } from '../data/crops'
import type { AreaUnit } from './units'
import { HA_PER_AC } from './units'

export type Economics = Record<string, { priceAudPerT?: number; costAudPerHa?: number }>

const ABARES_PRICES_URL = 'https://www.agriculture.gov.au/abares/data/weekly-commodity-price-update'

/** Prices and growing costs behind every dollar figure, with sources, editable per crop. */
export function EconomicsPanel({ crops, economics, unit, onChange }: { crops: Crop[]; economics: Economics; unit: AreaUnit; onChange: (e: Economics) => void }) {
  const k = unit === 'ha' ? 1 : HA_PER_AC
  const edited = Object.keys(economics).length > 0
  const set = (id: string, field: 'priceAudPerT' | 'costAudPerHa', v: number | undefined) => {
    const next = { ...economics, [id]: { ...economics[id], [field]: v } }
    if (next[id].priceAudPerT === undefined && next[id].costAudPerHa === undefined) delete next[id]
    onChange(next)
  }
  return (
    <details className="group rounded-2xl border border-space-700 bg-space-800 shadow-lg">
      <summary className="flex cursor-pointer select-none items-center justify-between gap-2 p-5 [&::-webkit-details-marker]:hidden">
        <span className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-300">
          <Receipt className="size-4 text-amber-400" /> Prices & costs
          {edited && <span className="rounded border border-amber-500/40 bg-amber-500/10 px-1.5 py-0.5 text-[10px] normal-case tracking-normal text-amber-300">edited</span>}
        </span>
        <span className="flex items-center gap-1 text-xs text-slate-400">
          Where the dollars come from <ChevronDown className="size-4 transition group-open:rotate-180" />
        </span>
      </summary>
      <div className="space-y-3 px-5 pb-5">
        <p className="text-xs leading-snug text-slate-400">
          Grain prices are{' '}
          <a className="inline-flex items-center gap-0.5 text-cyan-400 hover:underline" href={ABARES_PRICES_URL} target="_blank" rel="noreferrer">
            ABARES weekly export prices <ExternalLink className="size-3" />
          </a>{' '}
          ({PRICE_DATE}, FOB port) less ${FREIGHT_HANDLING_AUD_PER_T}/t for freight, receival and port charges. Chickpeas use ABARES’s quarterly delivered price (Crop Report, Sept 2026); mungbeans have no ABARES price series.
          Growing costs are indicative variable costs (seed, fertiliser, chemicals, operations, harvest, levies) and exclude land, machinery ownership and labour, so
          “ROI” is the return on variable costs. Type your own numbers to override.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-left text-[10px] uppercase text-slate-500">
              <tr>
                <th className="py-1 pr-2">Crop</th>
                <th className="pr-2">Farm-gate price $/t</th>
                <th className="pr-2">Growing cost $/{unit}</th>
                <th>Price source</th>
              </tr>
            </thead>
            <tbody>
              {crops.map((c) => {
                const o = economics[c.id] ?? {}
                return (
                  <tr key={c.id} className="border-t border-space-700 align-top">
                    <td className="py-2 pr-2 font-semibold text-slate-200">
                      {c.icon} {c.name}
                    </td>
                    <td className="py-1.5 pr-2">
                      <NumInput value={o.priceAudPerT ?? c.priceAudPerT} edited={o.priceAudPerT !== undefined} onChange={(v) => set(c.id, 'priceAudPerT', v === c.priceAudPerT ? undefined : v)} />
                    </td>
                    <td className="py-1.5 pr-2">
                      <NumInput
                        value={Math.round((o.costAudPerHa ?? c.costAudPerHa) * k)}
                        edited={o.costAudPerHa !== undefined}
                        onChange={(v) => {
                          const perHa = v / k
                          set(c.id, 'costAudPerHa', Math.round(perHa) === c.costAudPerHa ? undefined : perHa)
                        }}
                      />
                    </td>
                    <td className="py-2 text-[11px] leading-snug text-slate-400">{c.priceSource}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {edited && (
          <button onClick={() => onChange({})} className="flex items-center gap-1 text-xs text-slate-400 underline hover:text-white">
            <RotateCcw className="size-3" /> Reset to defaults
          </button>
        )}
      </div>
    </details>
  )
}

function NumInput({ value, edited, onChange }: { value: number; edited: boolean; onChange: (v: number) => void }) {
  return (
    <input
      type="number"
      min={0}
      step={10}
      value={Math.round(value)}
      onChange={(e) => {
        const v = Number(e.target.value)
        if (Number.isFinite(v) && v >= 0) onChange(v)
      }}
      className={`w-24 rounded-md border bg-space-900 px-2 py-1 font-mono text-xs focus:border-emerald-500 focus:outline-none ${
        edited ? 'border-amber-500/60 text-amber-200' : 'border-space-600 text-slate-200'
      }`}
    />
  )
}
