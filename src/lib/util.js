// ── Small shared helpers ──────────────────────────────────────────────────

/** Deterministic 32-bit FNV-1a hash of a string. */
export function hashStr(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v))

let uidCounter = 0
/** Collision-safe id (random + counter + time, no crypto dependency needed). */
export function uid(prefix = '') {
  uidCounter++
  return (
    prefix +
    Date.now().toString(36) +
    '-' +
    (Math.random().toString(36).slice(2, 8)) +
    '-' +
    uidCounter.toString(36)
  )
}

/** Collator that sorts numbers inside strings naturally ("Vol 2" < "Vol 10"). */
export const COLL = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })

/** Parse a volume/chapter-ish number ("3", "3.5", "3,5") → number | null. */
export function numOf(n) {
  if (n === null || n === undefined || n === '') return null
  const v = parseFloat(String(n).replace(',', '.'))
  return Number.isFinite(v) ? v : null
}

export function fmtDate(ts) {
  if (!ts) return ''
  try {
    return new Date(ts).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
  } catch {
    return ''
  }
}

export function download(filename, blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}

// ── Colour helpers ────────────────────────────────────────────────────────

export function hexToRgb(hex) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16)
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 }
}

export function rgbToHex(r, g, b) {
  const c = (v) => clamp(Math.round(v), 0, 255).toString(16).padStart(2, '0')
  return '#' + c(r) + c(g) + c(b)
}

export function rgbToHsl(r, g, b) {
  r /= 255; g /= 255; b /= 255
  const max = Math.max(r, g, b), min = Math.min(r, g, b)
  let h = 0, s = 0
  const l = (max + min) / 2
  if (max !== min) {
    const d = max - min
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
    if (max === r) h = ((g - b) / d + (g < b ? 6 : 0))
    else if (max === g) h = (b - r) / d + 2
    else h = (r - g) / d + 4
    h *= 60
  }
  return { h, s: s * 100, l: l * 100 }
}

export function hslToRgb(h, s, l) {
  h = ((h % 360) + 360) % 360; s = clamp(s, 0, 100) / 100; l = clamp(l, 0, 100) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let r, g, b
  if (h < 60) [r, g, b] = [c, x, 0]
  else if (h < 120) [r, g, b] = [x, c, 0]
  else if (h < 180) [r, g, b] = [0, c, x]
  else if (h < 240) [r, g, b] = [0, x, c]
  else if (h < 300) [r, g, b] = [x, 0, c]
  else [r, g, b] = [c, 0, x]
  return { r: (r + m) * 255, g: (g + m) * 255, b: (b + m) * 255 }
}

export function shade(hex, dh = 0, ds = 0, dl = 0) {
  const { r, g, b } = hexToRgb(hex)
  const { h, s, l } = rgbToHsl(r, g, b)
  const o = hslToRgb(h + dh, s + ds, l + dl)
  return rgbToHex(o.r, o.g, o.b)
}

/** Readable text colour on top of a given background. */
export function contrastText(hex) {
  const { r, g, b } = hexToRgb(hex)
  const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255
  return lum > 0.55 ? '#2b2015' : '#f5ead3'
}

/** A curated bookbinder-cloth palette — keeps generated spines looking homey. */
export const SPINE_PALETTE = [
  '#9d3b31', '#b5623a', '#c07b3b', '#b3924a', '#8d8f4a', '#6d8a56',
  '#4c7a63', '#417a7e', '#46709b', '#56609c', '#6f5a99', '#8a5588',
  '#99546c', '#7c5b4a', '#5c6670', '#a3574b', '#8a8177', '#6b4f6b',
  '#4e5a4e', '#587b8a',
]

/** Pick a stable spine colour for a book from its series (or title). */
export function autoSpineColor(book) {
  const key = (book.series || book.title || 'book').toString()
  const h = hashStr(key.toLowerCase())
  const base = SPINE_PALETTE[h % SPINE_PALETTE.length]
  const dl = ((h >>> 8) % 9) - 4 // slight per-book variation
  return shade(base, 0, 0, dl)
}

/** Effective spine colour: explicit override, else auto. */
export function spineColorOf(book) {
  return book?.spineColor || autoSpineColor(book || {})
}

// ── Book geometry (world units, shared by room + shelf views) ─────────────

/** How thick a book's spine is, in world px (12–34). Longer books = thicker. */
export function thicknessOf(book) {
  const pages = book.pages || 0
  const fromPages = pages ? Math.round(pages / 16) : 9
  const jitter = hashStr(book.id) % 5
  return clamp(11 + fromPages + jitter, 12, 34)
}

/** 0.86–1.0 — books of slightly different heights look organic. */
export function spineHeightFactor(book) {
  return 0.86 + (hashStr(book.id + 'h') % 15) / 100
}
