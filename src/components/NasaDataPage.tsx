import { ArrowLeft, BookOpen, Database, ExternalLink, FlaskConical, Satellite, Sprout, TriangleAlert, Workflow } from 'lucide-react'
import type { ReactNode } from 'react'
import { CROPS } from '../data/crops'
import { FLOWERING_END, FLOWERING_START, FROST_THRESHOLD_C, MAX_SEASON_DAYS, RAIN_EFFICIENCY, WATER_FAILURE_RATIO, soilMoistureAnomaly } from '../engine/model'
import type { DailySeries } from '../nasa/power'
import { CACHE_TTL_MS, HISTORY_YEARS, buildPowerUrl } from '../nasa/power'

interface Props {
  series: DailySeries | null
  placeName: string
  lat: number
  lon: number
}

// What each NASA POWER parameter is and how AcreCast uses it. Long names and units shown on the page
// come from the live API response when available; these are the fallbacks.
const PARAMS: { id: string; longname: string; units: string; meaning: string; use: string; usedInModel: boolean }[] = [
  {
    id: 'T2M_MAX',
    longname: 'Temperature at 2 Meters Maximum',
    units: '°C',
    meaning: 'Highest air temperature of the day, 2 m above the ground (screen height).',
    use: 'Growing degree days (with T2M_MIN), and heat-stress days when it exceeds a crop’s flowering threshold.',
    usedInModel: true,
  },
  {
    id: 'T2M_MIN',
    longname: 'Temperature at 2 Meters Minimum',
    units: '°C',
    meaning: 'Lowest air temperature of the day, 2 m above the ground.',
    use: `Growing degree days (with T2M_MAX), and frost days when it drops below ${FROST_THRESHOLD_C} °C during flowering.`,
    usedInModel: true,
  },
  {
    id: 'PRECTOTCORR',
    longname: 'Precipitation Corrected',
    units: 'mm/day',
    meaning: 'Total daily rainfall, bias-corrected against gauge observations.',
    use: 'Last-90-day rainfall on the telemetry panel, and in-season rain in the crop water balance.',
    usedInModel: true,
  },
  {
    id: 'GWETROOT',
    longname: 'Root Zone Soil Wetness',
    units: '0–1',
    meaning: 'How wet the soil is in the root zone (top ~1 m), as a fraction of saturation. 0 = bone dry, 1 = saturated.',
    use: 'The latest value fills the “Subsoil Water Bucket”: the water the next crop starts with.',
    usedInModel: true,
  },
  {
    id: 'ALLSKY_SFC_SW_DWN',
    longname: 'All Sky Surface Shortwave Downward Irradiance',
    units: 'MJ/m²/day',
    meaning: 'Sunlight energy reaching the ground each day, including the effect of cloud.',
    use: 'Shown in NASA Telemetry Mode. Not yet used in the yield model (a candidate for radiation-use-efficiency yield).',
    usedInModel: false,
  },
]

const SOURCES: Record<string, string> = {
  MERRA2: 'NASA GMAO MERRA-2 reanalysis — temperature, precipitation and soil wetness (~0.5° × 0.625° grid)',
  GEOSIT: 'NASA GMAO GEOS-IT — keeps the MERRA-2-style record current for the most recent days',
  SYN1DEG: 'NASA CERES SYN1deg — satellite-derived surface solar radiation (1° grid)',
  FLASHFLUX: 'NASA CERES FLASHFlux — near-real-time solar radiation for the latest days',
  POWER: 'NASA POWER project processing — unit conversion, bias correction, daily aggregation',
}

export function NasaDataPage({ series, placeName, lat, lon }: Props) {
  const url = series?.requestUrl ?? buildPowerUrl(lat, lon)
  const last7 = series ? Array.from({ length: Math.min(7, series.dates.length) }, (_, k) => series.dates.length - Math.min(7, series.dates.length) + k) : []
  const anomaly = series ? soilMoistureAnomaly(series) : null
  const gwetMissing = series ? series.gwet.filter((v) => Number.isNaN(v)).length : 0
  const sampleKey = series ? series.dates.at(-1)!.replace(/-/g, '') : '20261110'
  const sampleIdx = series ? series.dates.length - 1 : -1
  const fmt = (v: number | undefined, d = 2) => (v === undefined || Number.isNaN(v) ? '-999.0' : v.toFixed(d))

  return (
    <main className="mx-auto max-w-4xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
      <a href="#/" className="inline-flex items-center gap-1.5 text-xs font-semibold text-emerald-400 hover:text-emerald-300">
        <ArrowLeft className="size-3.5" /> Back to the forecaster
      </a>

      <div className="rounded-2xl border border-cyan-500/20 bg-gradient-to-r from-cyan-950/60 via-space-800 to-emerald-950/60 p-6 shadow-xl">
        <h1 className="flex items-center gap-2 text-2xl font-extrabold text-white">
          <Satellite className="size-6 text-cyan-400" /> How AcreCast uses NASA data
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-300">
          Every weather and soil number on the forecaster comes from one NASA source: the <strong className="text-cyan-300">NASA POWER</strong> (Prediction Of Worldwide Energy Resources)
          project run by NASA Langley Research Center. POWER turns NASA satellite observations and climate models into ready-to-use daily weather for any point on Earth.
          This page explains what that data contains, how we download and clean it, and exactly how it drives the crop recommendations.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <Fact label="Data source" value="NASA POWER" />
          <Fact label="Time step" value="Daily" />
          <Fact label="History per paddock" value={`${HISTORY_YEARS} yrs + this year`} />
          <Fact label="API key needed" value="None" />
        </div>
      </div>

      <Section icon={<Database className="size-4 text-cyan-400" />} title="1. What the data contains">
        <p>
          We request five daily parameters from the POWER <em>Agroclimatology</em> community. Each one is a single value per day for the grid cell containing the paddock.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-space-600">
                <th className="py-2 pr-3">Parameter</th>
                <th className="py-2 pr-3">What it measures</th>
                <th className="py-2">How AcreCast uses it</th>
              </tr>
            </thead>
            <tbody>
              {PARAMS.map((p) => {
                const live = series?.paramInfo?.[p.id]
                return (
                  <tr key={p.id} className="border-b border-space-700 align-top">
                    <td className="py-2.5 pr-3">
                      <code className="font-mono font-bold text-cyan-300">{p.id}</code>
                      <span className="block text-[11px] text-slate-400">{live?.longname ?? p.longname}</span>
                      <span className="block font-mono text-[11px] text-slate-500">units: {live ? (live.units === '1' ? '0–1' : live.units) : p.units}</span>
                    </td>
                    <td className="py-2.5 pr-3 text-slate-300">{p.meaning}</td>
                    <td className="py-2.5 text-slate-300">
                      {p.use}
                      {!p.usedInModel && <span className="mt-1 block text-[10px] font-semibold uppercase text-amber-400">display only</span>}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        <h3 className="pt-2 font-bold text-white">Where NASA POWER gets it</h3>
        <p>POWER doesn’t measure anything itself. It packages NASA science datasets. Each response lists the upstream sources it drew on:</p>
        <ul className="space-y-1.5">
          {(series?.sources ?? Object.keys(SOURCES)).map((s) => (
            <li key={s} className="flex gap-2">
              <code className="shrink-0 font-mono text-xs font-bold text-emerald-400">{s}</code>
              <span className="text-slate-300">{SOURCES[s] ?? 'NASA dataset'}</span>
            </li>
          ))}
        </ul>
        <p className="text-xs text-slate-400">
          {series?.apiVersion ? `Live response: POWER Daily API ${series.apiVersion}. ` : ''}Times are local solar time. Missing values are reported as −999.
        </p>
      </Section>

      <Section icon={<Workflow className="size-4 text-emerald-400" />} title="2. How the data is extracted">
        <Steps
          steps={[
            <>
              <strong className="text-white">You pick a paddock.</strong> A hub button or a map click gives us a latitude and longitude.
            </>,
            <>
              <strong className="text-white">One request to NASA.</strong> Your browser calls the POWER daily point API directly (there is no AcreCast server in between) for
              every day from 1 January {HISTORY_YEARS} years ago until today. That’s about {Math.round(HISTORY_YEARS * 365.25).toLocaleString()} days × 5 parameters, roughly
              300 KB, and it arrives in about two seconds.
            </>,
            <>
              <strong className="text-white">NASA replies with JSON.</strong> Each parameter is a map from date (<code className="font-mono">YYYYMMDD</code>) to value.
            </>,
            <>
              <strong className="text-white">We clean it.</strong> −999 fill values become “missing”. The last few days that NASA hasn’t published yet are trimmed. A missing
              temperature day is filled with the previous day’s value so thermal time stays continuous. Missing rainfall counts as 0 mm. Soil wetness and solar gaps stay missing,
              and we use the most recent valid value.
            </>,
            <>
              <strong className="text-white">We cache it.</strong> The cleaned series is saved in your browser for {CACHE_TTL_MS / 3_600_000} hours. If NASA can’t be reached
              later, the app falls back to the cached copy and says so with an amber “Offline” badge.
            </>,
          ]}
        />

        <h3 className="pt-2 font-bold text-white">The request for {placeName}</h3>
        <a href={url} target="_blank" rel="noreferrer" className="block break-all rounded-lg border border-space-700 bg-space-950 p-3 font-mono text-[11px] text-cyan-300 hover:border-cyan-700">
          {url} <ExternalLink className="inline size-3" />
        </a>

        <h3 className="pt-2 font-bold text-white">What comes back (trimmed)</h3>
        <pre className="overflow-x-auto rounded-lg border border-space-700 bg-space-950 p-3 font-mono text-[11px] leading-relaxed text-slate-300">
          {`{
  "header": { "fill_value": -999.0, "sources": ${JSON.stringify(series?.sources ?? ['MERRA2', '…'])} },
  "properties": {
    "parameter": {
      "T2M_MAX":           { …, "${sampleKey}": ${fmt(series?.tmax[sampleIdx])} },
      "T2M_MIN":           { …, "${sampleKey}": ${fmt(series?.tmin[sampleIdx])} },
      "PRECTOTCORR":       { …, "${sampleKey}": ${fmt(series?.precip[sampleIdx])} },
      "GWETROOT":          { …, "${sampleKey}": ${fmt(series?.gwet[sampleIdx])} },
      "ALLSKY_SFC_SW_DWN": { …, "${sampleKey}": ${fmt(series?.solar[sampleIdx])} }
    }
  }
}`}
        </pre>

        {series && (
          <>
            <h3 className="pt-2 font-bold text-white">Latest 7 days after cleaning: {placeName}</h3>
            <div className="overflow-x-auto rounded-lg border border-space-700 bg-space-950 p-3">
              <table className="w-full font-mono text-[11px] text-slate-300">
                <thead className="text-slate-500">
                  <tr>
                    <th className="text-left">Date</th>
                    <th>T2M_MAX °C</th>
                    <th>T2M_MIN °C</th>
                    <th>PRECTOTCORR mm</th>
                    <th>GWETROOT</th>
                    <th>Solar MJ/m²</th>
                  </tr>
                </thead>
                <tbody>
                  {last7.map((i) => (
                    <tr key={i} className="text-center">
                      <td className="text-left">{series.dates[i]}</td>
                      <td>{series.tmax[i].toFixed(1)}</td>
                      <td>{series.tmin[i].toFixed(1)}</td>
                      <td>{series.precip[i].toFixed(1)}</td>
                      <td>{Number.isNaN(series.gwet[i]) ? '—' : series.gwet[i].toFixed(2)}</td>
                      <td>{Number.isNaN(series.solar[i]) ? '—' : series.solar[i].toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="mt-2 text-[10px] text-slate-500">
                {series.dates.length.toLocaleString()} days on record, {series.dates[0]} → {series.dates.at(-1)}. {gwetMissing} days without a soil-wetness value.
              </p>
            </div>
          </>
        )}
      </Section>

      <Section icon={<FlaskConical className="size-4 text-amber-400" />} title="3. How the data drives the forecast">
        <Steps
          steps={[
            <>
              <strong className="text-white">Today’s soil water → the starting bucket.</strong> The most recent <code className="font-mono text-cyan-300">GWETROOT</code> value
              times the soil’s plant-available water capacity (PAWC, set per hub or with the slider) gives the stored water in mm. Example: 0.48 × 260 mm = 125 mm.
            </>,
            <>
              <strong className="text-white">Past seasons → an ensemble of possible futures.</strong> Nobody knows next season’s weather, so we replay the season against every
              past year in the record: sowing on 15 May (winter) or 15 October (spring), using that year’s real NASA weather. With {HISTORY_YEARS} years of data that’s about 10
              “what could happen” seasons, each starting from today’s soil water.
            </>,
            <>
              <strong className="text-white">Temperature → days to harvest.</strong> Each day adds growing degree days:{' '}
              <code className="font-mono text-cyan-300">GDD = max(0, (T2M_MAX + T2M_MIN)/2 − Tbase)</code>. A crop is ready when its total reaches the crop’s thermal target
              (e.g. chickpea: {CROPS[0].targetGdd.toLocaleString()} °C·d above {CROPS[0].tBase} °C). If it hasn’t matured within {MAX_SEASON_DAYS} days, it fails that season.
            </>,
            <>
              <strong className="text-white">Temperature → heat and frost damage.</strong> During flowering and grain fill (from {FLOWERING_START * 100}% to{' '}
              {FLOWERING_END * 100}% of the thermal target), each day with <code className="font-mono">T2M_MAX</code> above the crop’s heat threshold, or{' '}
              <code className="font-mono">T2M_MIN</code> below {FROST_THRESHOLD_C} °C, costs a crop-specific share of yield.
            </>,
            <>
              <strong className="text-white">Rain + soil water → water stress.</strong> Water supply = stored bucket + {RAIN_EFFICIENCY * 100}% of in-season{' '}
              <code className="font-mono">PRECTOTCORR</code> (the rest runs off or evaporates). Comparing that to the crop’s seasonal demand gives a water ratio. Below{' '}
              {WATER_FAILURE_RATIO * 100}% of demand the crop sets no grain; yield then rises to full at 100%, falling off faster for drought-sensitive crops like canola.
            </>,
            <>
              <strong className="text-white">Yield → dollars → ranking.</strong> Yield × price − costs gives profit in each replayed season. The leaderboard ranks crops by
              average return, minus the share of seasons that lost money. Off-season crops always go last.
            </>,
            <>
              <strong className="text-white">The Climate Stress Time Machine</strong> shifts every replayed day: the rainfall slider scales <code className="font-mono">PRECTOTCORR</code>
              , and the heatwave slider adds degrees to both <code className="font-mono">T2M_MAX</code> and <code className="font-mono">T2M_MIN</code>.
            </>,
          ]}
        />
        <p className="text-xs text-slate-400">
          Turn on <strong>NASA Telemetry Mode</strong> on the forecaster to see the raw values and the year-by-year replay table behind each crop.
        </p>
      </Section>

      <Section icon={<Sprout className="size-4 text-emerald-400" />} title="4. Climate factors, crop vulnerability and soil health">
        <p>
          A crop is vulnerable when the weather pushes it outside its comfort zone at the wrong moment, most of all around flowering. This table shows how each factor
          does damage, and how much of it AcreCast currently captures.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-space-600">
                <th className="py-2 pr-3">Factor</th>
                <th className="py-2 pr-3">Why it matters for crops & soil</th>
                <th className="py-2 pr-3">In AcreCast</th>
              </tr>
            </thead>
            <tbody>
              {FACTORS.map((f) => (
                <tr key={f.name} className="border-b border-space-700 align-top">
                  <td className="py-2.5 pr-3 font-semibold text-white">
                    {f.name}
                    <span className="block font-mono text-[10px] font-normal text-cyan-300">{f.data}</span>
                  </td>
                  <td className="py-2.5 pr-3 text-slate-300">{f.why}</td>
                  <td className="py-2.5 text-slate-300">
                    <StatusBadge status={f.status} />
                    <span className="mt-1 block">{f.how}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">These factors stack.</strong> A hot, dry spring raises evaporation just as rain stops, so the soil bucket empties faster at
          the moment the crop needs it most. That is why AcreCast replays whole seasons day by day instead of averaging each factor separately.
        </p>
      </Section>

      <Section icon={<BookOpen className="size-4 text-cyan-400" />} title="5. Key science terms explained">
        {anomaly && (
          <div className="rounded-xl border border-cyan-500/20 bg-space-900 p-3.5">
            <p className="text-xs font-bold text-cyan-300">Live example: soil moisture anomaly for {placeName}</p>
            <p className="mt-1 text-xs">
              Root-zone wetness on {anomaly.date} is <strong className="font-mono text-white">{anomaly.current.toFixed(2)}</strong>. The average for this time of year
              across the previous {anomaly.years} years is <strong className="font-mono text-white">{anomaly.normal.toFixed(2)}</strong>. That makes the anomaly{' '}
              <strong className={`font-mono ${anomaly.anomaly < 0 ? 'text-amber-300' : 'text-emerald-300'}`}>
                {anomaly.anomaly >= 0 ? '+' : ''}
                {anomaly.anomaly.toFixed(2)}
              </strong>{' '}
              ({anomaly.anomaly < -0.03 ? 'drier than usual' : anomaly.anomaly > 0.03 ? 'wetter than usual' : 'close to normal'} for the season).
            </p>
          </div>
        )}
        <dl className="space-y-3">
          {TERMS.map((t) => (
            <div key={t.term} className="rounded-xl border border-space-700 bg-space-900/60 p-3.5">
              <dt className="flex flex-wrap items-center gap-2">
                <span className="font-bold text-white">{t.term}</span>
                <StatusBadge status={t.status} />
              </dt>
              <dd className="mt-1 space-y-1 text-xs">
                <p>{t.what}</p>
                <p className="text-slate-400">
                  <strong className="text-slate-300">In AcreCast:</strong> {t.here}
                </p>
              </dd>
            </div>
          ))}
        </dl>
      </Section>

      <Section icon={<Satellite className="size-4 text-cyan-400" />} title="6. Satellite vs ground measurements">
        <p>
          A <strong className="text-white">ground station</strong> (a rain gauge, thermometer screen or soil-moisture probe) measures one spot very accurately. A{' '}
          <strong className="text-white">satellite</strong> sees everywhere, but it measures indirectly (reflected light, emitted microwaves) and averages over a large
          footprint. Each covers the other’s weak spots.
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-slate-400">
              <tr className="border-b border-space-600">
                <th className="py-2 pr-3"></th>
                <th className="py-2 pr-3">Ground-based</th>
                <th className="py-2">Satellite / model-based</th>
              </tr>
            </thead>
            <tbody>
              {COMPARE.map(([k, g, s]) => (
                <tr key={k} className="border-b border-space-700 align-top">
                  <td className="py-2 pr-3 font-semibold text-white">{k}</td>
                  <td className="py-2 pr-3 text-slate-300">{g}</td>
                  <td className="py-2 text-slate-300">{s}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <h3 className="pt-1 font-bold text-white">Why combining both is more accurate</h3>
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white">Bias correction.</strong> Satellites and models drift. Comparing them with gauges and thermometers lets scientists correct
            the bias everywhere, including places with no station. NASA POWER’s <code className="font-mono">PRECTOTCORR</code> is exactly this: model rainfall corrected
            with gauge-based observations.
          </li>
          <li>
            <strong className="text-white">Data assimilation.</strong> MERRA-2, the reanalysis behind most of our data, blends millions of satellite and ground
            observations into a physics model, so each fills the other’s gaps.
          </li>
          <li>
            <strong className="text-white">Ground truthing.</strong> A farmer’s own rain gauge or soil probe can calibrate the satellite picture for one paddock. In
            AcreCast, the soil water capacity (PAWC) slider is where local knowledge goes in today.
          </li>
        </ul>
        <p className="text-xs text-slate-400">
          <strong className="text-slate-300">Where AcreCast sits:</strong> all our weather and soil inputs come from NASA POWER, which already combines satellite, model and ground data.
          Next steps would be blending in local station records (such as the Bureau of Meteorology network) and on-farm probes to sharpen paddock-level accuracy.
        </p>
      </Section>

      <Section icon={<TriangleAlert className="size-4 text-amber-400" />} title="7. Limits worth knowing">
        <ul className="list-disc space-y-1.5 pl-5">
          <li>
            <strong className="text-white">It’s a grid cell, not your paddock.</strong> NASA POWER weather is about 50 km across. Local hills, frost hollows and storms
            that miss the grid are averaged out.
          </li>
          <li>
            <strong className="text-white">Soil wetness is modelled.</strong> <code className="font-mono">GWETROOT</code> comes from the MERRA-2 land model, not a direct
            measurement, and we treat it as the bucket fill fraction without paddock calibration. NASA SMAP satellite soil moisture would be a natural next upgrade.
          </li>
          <li>
            <strong className="text-white">A few days behind.</strong> The newest values are usually 3–5 days old. The forecaster shows the exact “observations through” date.
          </li>
          <li>
            <strong className="text-white">Past years aren’t a forecast.</strong> Replaying history shows the range of likely outcomes. It doesn’t predict El Niño or La
            Niña; use the rainfall slider to test those.
          </li>
          <li>
            <strong className="text-white">Prices and costs aren’t NASA data.</strong> They are indicative benchmarks, not financial advice.
          </li>
        </ul>
        <p className="text-xs text-slate-400">
          Learn more:{' '}
          <a className="text-cyan-400 hover:underline" href="https://power.larc.nasa.gov/docs/" target="_blank" rel="noreferrer">
            NASA POWER documentation
          </a>{' '}
          ·{' '}
          <a className="text-cyan-400 hover:underline" href="https://power.larc.nasa.gov/data-access-viewer/" target="_blank" rel="noreferrer">
            POWER Data Access Viewer
          </a>
        </p>
      </Section>
    </main>
  )
}

type Status = 'used' | 'partial' | 'planned'

function StatusBadge({ status }: { status: Status }) {
  const m = {
    used: ['Used in AcreCast', 'border-emerald-500/40 bg-emerald-500/10 text-emerald-300'],
    partial: ['Partly used / approximated', 'border-amber-500/40 bg-amber-500/10 text-amber-300'],
    planned: ['Not used yet: future upgrade', 'border-slate-500/40 bg-slate-500/10 text-slate-300'],
  }[status]
  return <span className={`inline-block rounded border px-1.5 py-0.5 text-[10px] font-semibold uppercase ${m[1]}`}>{m[0]}</span>
}

const FACTORS: { name: string; data: string; why: string; how: string; status: Status }[] = [
  {
    name: 'Temperature',
    data: 'T2M_MAX · T2M_MIN',
    why: 'Sets how fast a crop develops. Heatwaves at flowering abort flowers and shrivel grain, and warmer seasons also shorten the time a crop has to fill grain.',
    how: 'Drives growing degree days, days to harvest and heat-stress days. The heatwave slider tests warmer futures.',
    status: 'used',
  },
  {
    name: 'Frost',
    data: `T2M_MIN < ${FROST_THRESHOLD_C} °C`,
    why: 'A frost during flowering or early grain fill can kill the developing grain overnight, even in an otherwise good season.',
    how: 'Frost days inside each crop’s flowering window cut yield by a crop-specific amount.',
    status: 'used',
  },
  {
    name: 'Rainfall',
    data: 'PRECTOTCORR',
    why: 'Refills the soil water bucket. In-season rain decides whether the crop can finish, and heavy falls on bare soil cause erosion.',
    how: `In-season rain (${RAIN_EFFICIENCY * 100}% counted as useful) feeds the water balance. The rainfall slider tests drought or wet years.`,
    status: 'used',
  },
  {
    name: 'Soil moisture',
    data: 'GWETROOT',
    why: 'Stored subsoil water carries crops through dry spells. Moist soil also keeps soil biology and nutrient cycling active, a core part of soil health.',
    how: 'Today’s value sets the starting bucket for every replayed season. The anomaly (below) shows whether it is unusually wet or dry.',
    status: 'used',
  },
  {
    name: 'Evaporation & evapotranspiration',
    data: 'not fetched',
    why: 'Water leaves the paddock by evaporating from soil and transpiring through leaves. High demand on hot, windy days drains the bucket fast.',
    how: `Approximated: each crop has a fixed seasonal water demand, ${WATER_FAILURE_RATIO * 100}% of it is treated as lost to soil evaporation, and only ${RAIN_EFFICIENCY * 100}% of rain counts. Not yet measured from NASA data.`,
    status: 'partial',
  },
  {
    name: 'Vegetation stress',
    data: 'not fetched',
    why: 'Stressed crops reflect light differently, so satellites can spot drought or disease before a farmer sees it. Groundcover also protects soil from erosion.',
    how: 'Not used yet. Vegetation indices such as NDVI would let AcreCast check actual crop condition during the season.',
    status: 'planned',
  },
  {
    name: 'Soil health (nitrogen)',
    data: 'crop benchmarks',
    why: 'Pulses fix nitrogen from the air for the next crop, while cereals and canola draw it down. Rotations shape fertiliser bills and soil fertility.',
    how: 'Shown as a next-season nitrogen credit, with a small ranking bonus for legumes. This comes from agronomic benchmarks, not NASA data.',
    status: 'partial',
  },
]

const TERMS: { term: string; what: string; here: string; status: Status }[] = [
  {
    term: 'Growing degree days (GDD)',
    what: 'A “heat bank” for crops. Each day deposits the amount by which the average temperature beats the crop’s base temperature. A crop flowers and matures after a set total, so warm seasons are shorter.',
    here: 'Calculated daily from T2M_MAX and T2M_MIN to predict days to harvest and when flowering happens.',
    status: 'used',
  },
  {
    term: 'Frost risk',
    what: 'The chance of air temperature falling low enough for ice to form on plants. Air at screen height (2 m) is usually a couple of degrees warmer than at the crop canopy, so a 2 m minimum near 0–2 °C already signals ground frost.',
    here: `Counted as days with T2M_MIN below ${FROST_THRESHOLD_C} °C. These hurt yield only during flowering and grain fill, when crops are most sensitive.`,
    status: 'used',
  },
  {
    term: 'Soil moisture & root-zone wetness',
    what: 'How much water the soil holds. NASA POWER’s GWETROOT reports it for the root zone as a fraction of saturation, from 0 (dry) to 1 (waterlogged).',
    here: 'The latest value fills the Subsoil Water Bucket on the forecaster.',
    status: 'used',
  },
  {
    term: 'Soil moisture anomaly',
    what: 'The difference between today’s soil moisture and the long-term average for the same time of year. A negative anomaly means drier than normal, even if the raw number looks fine. This is how drought monitors flag emerging dry spells.',
    here: 'Calculated live on this page from the 10 years of GWETROOT already downloaded. The forecast itself uses the raw value.',
    status: 'partial',
  },
  {
    term: 'Water-balance indicators',
    what: 'Bookkeeping for paddock water: what goes in (stored soil water and rain) against what goes out (crop use and evaporation). Plant-available water capacity (PAWC) is the size of the soil’s “bucket”.',
    here: 'The water ratio (supply ÷ crop demand) decides water stress. Below 20% of demand the crop fails. PAWC is set per hub or with the slider.',
    status: 'used',
  },
  {
    term: 'Evapotranspiration (ET)',
    what: 'Evaporation from the soil plus transpiration through leaves: the total water a crop paddock uses. It rises with heat, sunlight, wind and dry air. NASA’s ECOSTRESS instrument maps actual ET from space using land-surface temperature.',
    here: 'Approximated with fixed crop water demands and fixed loss factors. Using ECOSTRESS or NASA POWER evaporation data is a natural upgrade.',
    status: 'partial',
  },
  {
    term: 'Vegetation indices (NDVI)',
    what: 'The Normalised Difference Vegetation Index compares red light (absorbed by healthy leaves) with near-infrared (reflected by them): NDVI = (NIR − Red) ÷ (NIR + Red). Values near 0.8 mean dense healthy crop; near 0.1 means bare soil. Falling NDVI can reveal water or heat stress early. NASA satellites such as MODIS, VIIRS and Landsat measure it.',
    here: 'Not used yet. It would let AcreCast check the crop actually in the ground mid-season, not just the weather.',
    status: 'planned',
  },
]

const COMPARE: [string, string, string][] = [
  ['Coverage', 'Single points; stations can be 50–100+ km apart in the grain belt', 'Every location on Earth, including paddocks with no nearby station'],
  ['Resolution', 'Exact for that spot', 'Averaged over a grid cell (about 50 km for NASA POWER weather)'],
  ['What is measured', 'The quantity itself (mm of rain, °C)', 'Usually inferred from radiation, then processed with models'],
  ['History', 'Long records where stations exist, with gaps when they close', 'Consistent global records (NASA POWER from 1981 for daily weather)'],
  ['Freshness', 'Often near-real-time', 'A few days’ delay for processed products'],
  ['Typical error', 'Low at the site; unrepresentative away from it', 'Can miss local storms, frost hollows and soil differences'],
]

function Section({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <section className="space-y-3 rounded-2xl border border-space-700 bg-space-800 p-5 text-sm leading-relaxed text-slate-300 shadow-lg">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider text-slate-200">
        {icon} {title}
      </h2>
      {children}
    </section>
  )
}

function Steps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className="space-y-2.5">
      {steps.map((s, i) => (
        <li key={i} className="flex gap-3">
          <span className="flex size-6 shrink-0 items-center justify-center rounded-full border border-emerald-500/40 bg-emerald-500/10 font-mono text-[11px] font-bold text-emerald-300">
            {i + 1}
          </span>
          <span>{s}</span>
        </li>
      ))}
    </ol>
  )
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-space-700 bg-space-900/70 p-2.5">
      <span className="block text-[10px] uppercase text-slate-400">{label}</span>
      <span className="font-mono text-sm font-bold text-white">{value}</span>
    </div>
  )
}
