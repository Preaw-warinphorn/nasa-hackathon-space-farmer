export const aud = (n: number, signed = false) => {
  const s = `$${Math.round(Math.abs(n)).toLocaleString('en-AU')}`
  if (n < 0) return `-${s}`
  return signed ? `+${s}` : s
}

export const shortDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'short' })
export const longDate = (d: Date) => d.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })
export const isoToDate = (iso: string) => new Date(`${iso}T00:00:00`)
