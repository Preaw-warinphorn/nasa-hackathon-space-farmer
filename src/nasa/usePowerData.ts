import { useCallback, useEffect, useState } from 'react'
import type { DailySeries, DataSource } from './power'
import { fetchPowerDaily } from './power'

export type PowerState =
  | { status: 'loading'; series: DailySeries | null; source: DataSource | null }
  | { status: 'ready'; series: DailySeries; source: DataSource }
  | { status: 'error'; series: DailySeries | null; source: DataSource | null; error: string }

/** Loads NASA POWER daily history for a point. Keeps showing the previous location while loading. */
export function usePowerData(lat: number, lon: number) {
  const [state, setState] = useState<PowerState>({ status: 'loading', series: null, source: null })
  const [nonce, setNonce] = useState(0)

  useEffect(() => {
    const ctrl = new AbortController()
    setState((s) => ({ status: 'loading', series: s.series, source: s.source }))
    fetchPowerDaily(lat, lon, ctrl.signal)
      .then(({ series, source }) => setState({ status: 'ready', series, source }))
      .catch((err: Error) => {
        if (err.name === 'AbortError') return
        setState((s) => ({ status: 'error', series: s.series, source: s.source, error: err.message || 'Could not reach NASA POWER' }))
      })
    return () => ctrl.abort()
  }, [lat, lon, nonce])

  const retry = useCallback(() => setNonce((n) => n + 1), [])
  return { state, retry }
}
