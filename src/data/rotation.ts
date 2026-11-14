// Crop-rotation history rules: what last season's crop does to this season's candidates.
// Multipliers follow common GRDC agronomy guidance (break-crop benefits, disease carry-over,
// legume nitrogen legacy). They are indicative rules of thumb, not paddock-calibrated.

export type PreviousCrop = 'none' | 'cereal' | 'canola' | 'pulse' | 'sorghum' | 'cotton' | 'fallow'

export const PREVIOUS_CROPS: { id: PreviousCrop; label: string }[] = [
  { id: 'none', label: '— None / new paddock —' },
  { id: 'cereal', label: 'Wheat / barley / oats (cereal)' },
  { id: 'canola', label: 'Canola / mustard (oilseed)' },
  { id: 'pulse', label: 'Chickpeas / faba beans / lupins (legume)' },
  { id: 'sorghum', label: 'Grain sorghum / maize (coarse grain)' },
  { id: 'cotton', label: 'Cotton (deep taproot)' },
  { id: 'fallow', label: 'Fallow / cover crop (soil rested)' },
]

export type RotationTone = 'good' | 'bad' | 'neutral'

export interface RotationEffect {
  yieldMult: number
  /** Saved input cost (AUD/acre), e.g. less nitrogen fertiliser after a legume. */
  costSavingAudPerAc: number
  /** Added to the 0–100 investment score. */
  scoreBonus: number
  note: string
  tone: RotationTone
}

const NEUTRAL: RotationEffect = { yieldMult: 1, costSavingAudPerAc: 0, scoreBonus: 0, note: 'Standard rotation fit.', tone: 'neutral' }

const CEREALS = new Set(['wheat', 'barley'])
const PULSES = new Set(['chickpea', 'mungbean'])

export function rotationEffect(prev: PreviousCrop, cropId: string): RotationEffect {
  const fx = (yieldMult: number, scoreBonus: number, note: string, costSavingAudPerAc = 0): RotationEffect => ({
    yieldMult,
    costSavingAudPerAc,
    scoreBonus,
    note,
    tone: yieldMult > 1 ? 'good' : yieldMult < 1 ? 'bad' : 'neutral',
  })
  switch (prev) {
    case 'cereal':
      if (CEREALS.has(cropId)) return fx(0.85, -12, 'Cereal on cereal: root disease (take-all, crown rot) carry-over, about −15% yield.')
      if (PULSES.has(cropId)) return fx(1.1, 10, 'Break crop: a pulse breaks cereal disease cycles and puts nitrogen back.')
      return NEUTRAL
    case 'canola':
      if (cropId === 'canola') return fx(0.8, -15, 'Canola on canola: high blackleg risk, about −20% yield.')
      return fx(1.05, 5, "Good break: crops after canola benefit from its disease-break (biofumigation) effect.")
    case 'pulse':
      if (CEREALS.has(cropId) || cropId === 'sorghum')
        return fx(1.15, 12, 'Legume legacy: ~50 kg N/ha left by last year’s pulse, about +15% yield and $45/ac less fertiliser.', 45)
      if (cropId === 'chickpea') return fx(0.88, -10, 'Pulse on pulse: higher Ascochyta blight and disease risk.')
      return NEUTRAL
    case 'cotton':
      if (cropId === 'canola' || cropId === 'wheat') return fx(0.9, -6, 'Cotton dried out the deep subsoil, so thirsty crops lose yield.')
      if (cropId === 'chickpea' || cropId === 'sorghum') return fx(1.05, 6, 'Handles the low moisture cotton leaves behind.')
      return NEUTRAL
    case 'fallow':
      return fx(1.12, 7, 'Rested paddock: fallow stored extra moisture and nutrients, about +12% yield.')
    default:
      return NEUTRAL
  }
}

/** Supplemental irrigation cost: AUD per mm per hectare. */
export const IRRIGATION_AUD_PER_MM_HA = 0.8
export const HA_PER_ACRE = 0.404686
