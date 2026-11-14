// Display units. The engine works in hectares; acres are a display option only.
import { aud } from './format'

export type AreaUnit = 'ha' | 'ac'

export const HA_PER_AC = 0.404686
const AC_PER_HA = 1 / HA_PER_AC

/** Hectares → display number in the chosen unit. */
export const toUnit = (ha: number, u: AreaUnit) => (u === 'ha' ? ha : ha * AC_PER_HA)
/** Display number in the chosen unit → hectares. */
export const fromUnit = (v: number, u: AreaUnit) => (u === 'ha' ? v : v * HA_PER_AC)

export const fmtArea = (ha: number, u: AreaUnit) => `${Math.round(toUnit(ha, u)).toLocaleString('en-AU')} ${u}`
/** t/ha → "2.31 t/ha" or "0.93 t/ac". */
export const fmtYield = (tHa: number, u: AreaUnit) => `${(u === 'ha' ? tHa : tHa * HA_PER_AC).toFixed(2)} t/${u}`
/** A$ per ha → "$480/ha" or "$194/ac". */
export const fmtPerArea = (audPerHa: number, u: AreaUnit, signed = false) => `${aud(u === 'ha' ? audPerHa : audPerHa * HA_PER_AC, signed)}/${u}`
