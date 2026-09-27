// ── CBZ import pipeline ───────────────────────────────────────────────────
// Given dropped .cbz/.zip files this extracts:
//   • the cover (first image, downscaled to ≤ 640px, re-encoded as JPEG)
//   • metadata — from ComicInfo.xml when present, else parsed from the filename
//   • page count (used for realistic spine thickness)
// The comic file itself is never kept.

import { openZip } from './zip.js'
import { uid, shade, rgbToHsl, hexToRgb, hslToRgb, rgbToHex, clamp } from './util.js'

/** Recursively collect files from a DataTransfer (supports dropped folders). */
export function collectFiles(dt) {
  const out = []
  const items = dt.items ? Array.from(dt.items) : []
  const entries = []
  // Item list is neuted after the first await — grab entries synchronously.
  for (const it of items) {
    if (it.kind !== 'file') continue
    const entry = it.webkitGetAsEntry?.()
    if (entry) entries.push(entry)
    else {
      const f = it.getAsFile()
      if (f) out.push(f)
    }
  }

  async function walk(entry, path) {
    if (entry.isFile) {
      const file = await new Promise((res, rej) => entry.file(res, rej)).catch(() => null)
      if (file) out.push(file)
    } else if (entry.isDirectory) {
      const reader = entry.createReader()
      const readAll = async () => {
        const batch = await new Promise((res, rej) => reader.readEntries(res, rej)).catch(() => [])
        if (batch.length) {
          for (const e of batch) await walk(e, path + entry.name + '/')
          await readAll() // readEntries returns pages of 100
        }
      }
      await readAll()
    }
  }

  return (async () => {
    for (const e of entries) await walk(e, '')
    return out
  })()
}

// ── filename → { series, number, title } ──────────────────────────────────

const VOL_WORD = '(?:volumes?|vols?|v|tomes?|t|chapters?|chs?|ch|parts?|pt|nos?|no|bk|#)'
const VOL_RE = new RegExp('[\\s\\-_\\[]+(' + VOL_WORD + ')\\.?[\\s.]*(\\d{1,4}(?:[._]\\d{1,2})?|[ivxlcdm]{1,7})\\]?\\s*$', 'i')
const ROMAN = { i: 1, ii: 2, iii: 3, iv: 4, v: 5, vi: 6, vii: 7, viii: 8, ix: 9, x: 10, xi: 11, xii: 12, xiii: 13, xiv: 14, xv: 15, xvi: 16, xvii: 17, xviii: 18, xix: 19, xx: 20 }

function romanToInt(s) {
  const v = ROMAN[s.toLowerCase()]
  return v === undefined ? null : v
}

/** Best-effort series/volume parse from a filename like "Berserk v05.cbz". */
export function parseFilename(filename) {
  let s = filename.replace(/\.(cbz|zip)$/i, '').trim()
  // drop trailing release-group tags: "... [Group]", possibly several
  for (let i = 0; i < 3; i++) s = s.replace(/\s*\[[^\][]*\]\s*$/, '').trim()
  // pull off a trailing "(1997)"-style year group
  const yearM = s.match(/\s*[([]\s*((?:19|20)\d{2})\s*[)\]]\s*$/)
  if (yearM) s = s.slice(0, yearM.index).trim()

  let series = ''
  let number = null

  const m = s.match(VOL_RE)
  if (m) {
    series = s.slice(0, m.index).trim()
    const n = parseFloat(m[2].replace(',', '.'))
    number = Number.isFinite(n) ? n : romanToInt(m[2])
  } else {
    // plain trailing number: "Series 08", "Series 2.5", "Series.5"
    const m2 = s.match(/[\s\-–—_[.](\d{1,4}(?:[._]\d{1,2})?)\s*$/)
    if (m2 && m2.index > 0) {
      series = s.slice(0, m2.index).replace(/[\s\-–—_[.]+$/, '').trim()
      number = parseFloat(m2[1].replace('_', '.'))
    }
  }
  if (!series) series = s
  return { series, number, title: series }
}

// ── ComicInfo.xml ─────────────────────────────────────────────────────────

async function readComicInfo(zip) {
  const entry = zip.entries.find(
    (e) => e.name.toLowerCase().endsWith('comicinfo.xml') && !e.name.includes('__MACOSX'),
  )
  if (!entry) return null
  try {
    const text = await (await zip.read(entry)).text()
    const doc = new DOMParser().parseFromString(text, 'text/xml')
    const get = (tag) => doc.querySelector(tag)?.textContent?.trim() || ''
    return {
      series: get('Series'),
      title: get('Title'),
      number: get('Number'),
      author: get('Writer') || get('Penciller') || '',
      pages: parseInt(get('PageCount'), 10) || 0,
    }
  } catch {
    return null
  }
}

/**
 * Open a comic archive, recursing into a nested .cbz/.zip if the outer
 * archive contains no images (some tools wrap CBZs in another zip).
 * Throws a descriptive error when no pages can be found at all.
 */
export async function openComic(file, depth = 0) {
  const zip = await openZip(file)
  if (zip.pages.length) return zip

  const nested = zip.entries.find(
    (e) => /\.(cbz|zip)$/i.test(e.name) && !e.name.includes('__MACOSX') && !e.name.endsWith('/'),
  )
  if (nested && depth < 2) {
    const inner = await zip.read(nested)
    return openComic(inner, depth + 1)
  }

  // Nothing readable — help the user (and bug reports) see what's inside
  const names = zip.entries
    .filter((e) => !e.name.endsWith('/'))
    .slice(0, 4)
    .map((e) => e.name.split('/').pop() || e.name)
  throw new Error('No images inside — contains ' + (names.join(', ') || 'nothing'))
}

// ── image helpers ─────────────────────────────────────────────────────────

/** Downscale an image blob to ≤ maxW wide and re-encode as JPEG. */
export async function shrinkImage(blob, maxW = 640, quality = 0.86) {
  try {
    const bmp = await createImageBitmap(blob)
    if (bmp.width > maxW) {
      const scale = maxW / bmp.width
      const w = Math.round(bmp.width * scale)
      const h = Math.round(bmp.height * scale)
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      canvas.getContext('2d').drawImage(bmp, 0, 0, w, h)
      const out = await new Promise((res) => canvas.toBlob(res, 'image/jpeg', quality))
      bmp.close()
      if (out) return out
    }
    // Small enough (or encode failed) — pass through as-is.
    bmp.close()
    return blob
  } catch {
    return blob
  }
}

/** Dominant colour of an image, nudged into a pleasant muted range. */
export async function dominantColor(blob) {
  try {
    const bmp = await createImageBitmap(blob)
    const size = 24
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const ctx = canvas.getContext('2d', { willReadFrequently: true })
    ctx.drawImage(bmp, 0, 0, size, size)
    bmp.close()
    const { data } = ctx.getImageData(0, 0, size, size)

    // Bucket colours coarsely (4 bits/channel) and prefer saturated buckets.
    const buckets = new Map()
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3]
      if (a < 128) continue
      const key = ((r >> 4) << 8) | ((g >> 4) << 4) | (b >> 4)
      const { h, s, l } = rgbToHsl(r, g, b)
      const weight = 1 + (s / 100) * 2 - (l > 88 || l < 10 ? 0.8 : 0)
      const cur = buckets.get(key) || { w: 0, r: 0, g: 0, b: 0, n: 0, h: 0, s: 0, l: 0 }
      cur.w += weight; cur.n++
      cur.r += r; cur.g += g; cur.b += b
      cur.h += h; cur.s += s; cur.l += l
      buckets.set(key, cur)
    }
    let best = null
    for (const v of buckets.values()) if (!best || v.w > best.w) best = v
    if (!best) return null

    // Average hue of the winning bucket, then clamp into book-cloth territory.
    let h = best.h / best.n
    const s = clamp(best.s / best.n, 26, 62)
    const l = clamp(best.l / best.n, 30, 58)
    // snap hue to 5° steps so library colours feel curated
    h = Math.round(h / 5) * 5
    const rgb = hslToRgb(h, s, l)
    return rgbToHex(rgb.r, rgb.g, rgb.b)
  } catch {
    return null
  }
}

// ── the import step for one CBZ file ──────────────────────────────────────

/**
 * @returns {{ book: object, coverBlob: Blob|null, coverId: string|null }}
 *   `book` has no id/order yet — caller assigns those.
 */
export async function importCbz(file) {
  const zip = await openComic(file)
  const info = (await readComicInfo(zip)) || {}

  const first = zip.pages[0]
  const rawCover = await zip.read(first)
  const coverBlob = await shrinkImage(rawCover, 640)
  const color = await dominantColor(coverBlob)

  const parsed = parseFilename(file.name)
  const series = info.series || parsed.series || ''
  const number =
    info.number && info.number !== ''
      ? info.number
      : parsed.number !== null && parsed.number !== undefined
        ? parsed.number
        : ''
  const author = info.author || ''
  const pages = info.pages || zip.pages.length

  const book = {
    title: info.title || series || parsed.title || file.name,
    series,
    number: number === '' ? null : number,
    author,
    pages: pages || null,
    spineColor: color || null,
    notes: '',
  }
  const hasRealCover = coverBlob.size > 0 && coverBlob.type.startsWith('image/')
  return { book, coverBlob: hasRealCover ? coverBlob : null, coverId: hasRealCover ? uid('cov-') : null }
}

export const isCbzFile = (f) => /\.(cbz|zip)$/i.test(f.name)
