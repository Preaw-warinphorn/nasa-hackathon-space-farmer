export interface Hub {
  id: string
  label: string
  name: string
  emoji: string
  lat: number
  lon: number
  soilType: string
  /** Plant-available water capacity of the root zone (mm). */
  pawcMm: number
}

// PAWC values are typical figures for the dominant soil type (APSoil-style ranges).
export const HUBS: Hub[] = [
  { id: 'moree', label: 'Moree, NSW', name: 'Moree, Northern NSW', emoji: '🌾', lat: -29.46, lon: 149.84, soilType: 'Black Vertosol (cracking clay)', pawcMm: 260 },
  { id: 'dalby', label: 'Dalby, QLD', name: 'Dalby, Darling Downs, QLD', emoji: '🚜', lat: -27.18, lon: 151.26, soilType: 'Black Vertosol plains', pawcMm: 250 },
  { id: 'riverina', label: 'Wagga, NSW', name: 'Wagga Wagga, Riverina, NSW', emoji: '🍇', lat: -35.12, lon: 147.37, soilType: 'Red Kandosol / Sodosol', pawcMm: 170 },
  { id: 'wimmera', label: 'Horsham, VIC', name: 'Horsham, Wimmera, VIC', emoji: '🌱', lat: -36.71, lon: 142.2, soilType: 'Grey & Brown Calcarosol', pawcMm: 180 },
  { id: 'wheatbelt', label: 'Merredin, WA', name: 'Merredin, WA Wheatbelt', emoji: '☀️', lat: -31.48, lon: 118.28, soilType: 'Yellow sandy clay', pawcMm: 110 },
  { id: 'dubbo', label: 'Dubbo, NSW', name: 'Dubbo, Central West NSW', emoji: '🌻', lat: -32.25, lon: 148.61, soilType: 'Red-Brown Earth', pawcMm: 180 },
]

export const DEFAULT_PAWC_MM = 180

export function isInAustralia(lat: number, lon: number): boolean {
  return lat <= -9 && lat >= -44 && lon >= 112 && lon <= 154
}
