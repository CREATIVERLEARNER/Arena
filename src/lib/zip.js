// ── Minimal ZIP/CBZ reader ────────────────────────────────────────────────
// CBZ files are just ZIP archives of images. This reader parses the central
// directory directly and decompresses entries with the platform's built-in
// DecompressionStream('deflate-raw') — no external dependency.
//
// DOM-free on purpose so it can be unit-tested under Node.

const EOCD_SIG = 0x06054b50 // end of central directory
const CDFH_SIG = 0x02014b50 // central directory file header
const LFH_SIG = 0x04034b50 // local file header

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif)$/i

function isImageEntry(name) {
  if (name.includes('__MACOSX')) return false
  const base = name.split('/').pop()
  if (!base || base.startsWith('.')) return false
  return IMAGE_RE.test(base)
}

/**
 * Open a ZIP/CBZ file (a File or Blob).
 * Returns { entries, pages, read } where `pages` is the naturally-sorted list
 * of image entries and `read(entryOrName)` returns a Blob of that entry.
 */
export async function openZip(file) {
  const tailLen = Math.min(file.size, 66000) // EOCD + max comment
  const tail = new DataView(await file.slice(file.size - tailLen).arrayBuffer())

  // Scan backwards for the end-of-central-directory record.
  let eocd = -1
  for (let i = tail.byteLength - 22; i >= 0; i--) {
    if (tail.getUint32(i, true) === EOCD_SIG) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('Not a ZIP/CBZ file')

  const count = tail.getUint16(eocd + 10, true)
  const cdSize = tail.getUint32(eocd + 12, true)
  const cdOffset = tail.getUint32(eocd + 16, true)
  if (count === 0xffff || cdOffset === 0xffffffff || cdSize === 0xffffffff) {
    throw new Error('ZIP64 archives are not supported (re-save the CBZ)')
  }

  // Read + parse the central directory from the original file.
  const cd = new DataView(await file.slice(cdOffset, cdOffset + cdSize).arrayBuffer())
  const entries = []
  let p = 0
  while (p + 46 <= cd.byteLength && entries.length < count) {
    if (cd.getUint32(p, true) !== CDFH_SIG) break
    const flags = cd.getUint16(p + 8, true)
    const method = cd.getUint16(p + 10, true)
    const compSize = cd.getUint32(p + 20, true)
    const nameLen = cd.getUint16(p + 28, true)
    const extraLen = cd.getUint16(p + 30, true)
    const commentLen = cd.getUint16(p + 32, true)
    const localOffset = cd.getUint32(p + 42, true)
    const name = new TextDecoder().decode(new Uint8Array(cd.buffer, p + 46, nameLen))
    entries.push({ name, flags, method, compSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  if (!entries.length) throw new Error('Empty archive')

  const coll = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
  const pages = entries
    .filter((e) => isImageEntry(e.name))
    .sort((a, b) => coll.compare(a.name, b.name))

  async function read(entry) {
    if (typeof entry === 'string') entry = entries.find((e) => e.name === entry)
    if (!entry) throw new Error('Entry not found: ' + entry)
    if (entry.flags & 0x1) throw new Error('Archive is password-protected')
    if (entry.method !== 0 && entry.method !== 8) {
      throw new Error('Unsupported compression method ' + entry.method)
    }
    // Parse the local header to find where the data actually starts.
    const lh = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer())
    if (lh.getUint32(0, true) !== LFH_SIG) throw new Error('Corrupt local header')
    const nameLen = lh.getUint16(26, true)
    const extraLen = lh.getUint16(28, true)
    const start = entry.localOffset + 30 + nameLen + extraLen
    const raw = file.slice(start, start + entry.compSize)
    if (entry.method === 0) return raw
    const ds = new DecompressionStream('deflate-raw')
    return new Response(raw.stream().pipeThrough(ds)).blob()
  }

  return { entries, pages, read }
}
