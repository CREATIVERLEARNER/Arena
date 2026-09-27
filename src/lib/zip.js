// ── Minimal ZIP/CBZ reader ────────────────────────────────────────────────
// CBZ files are just ZIP archives of images. This reader parses the central
// directory directly and decompresses entries with the platform's built-in
// DecompressionStream('deflate-raw') — no external dependency.
//
// Images are found by extension first; if nothing matches (scanlation dumps
// sometimes use extension-less pages) we fall back to sniffing magic bytes,
// decompressing just the first few bytes of each entry.
//
// DOM-free on purpose so it can be unit-tested under Node.

const EOCD_SIG = 0x06054b50 // end of central directory
const CDFH_SIG = 0x02014b50 // central directory file header
const LFH_SIG = 0x04034b50 // local file header

const IMAGE_RE = /\.(jpe?g|png|webp|gif|bmp|avif|jfif|jpe|jp2|jpx|j2k|jxl|tiff?|heic|heif|svg)$/i

function isImageEntry(name) {
  if (name.includes('__MACOSX')) return false
  const base = name.split(/[\\/]/).pop() // tolerate windows-style paths
  if (!base || base.startsWith('.')) return false
  return IMAGE_RE.test(base)
}

/** Detect an image format from the first bytes of a file. */
export function looksLikeImageBytes(b) {
  if (!b || b.length < 4) return false
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return true // jpeg
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return true // png
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return true // gif
  if (b[0] === 0x42 && b[1] === 0x4d) return true // bmp
  const head = String.fromCharCode.apply(null, b.subarray(0, Math.min(16, b.length)))
  if (head.startsWith('RIFF') && head.slice(8, 12) === 'WEBP') return true
  if (head.slice(4, 8) === 'ftyp') {
    const brand = head.slice(8, 12)
    if (['avif', 'avis', 'heic', 'heix', 'hevc', 'mif1', 'msf1'].includes(brand)) return true
  }
  if (b[0] === 0xff && b[1] === 0x0a) return true // jxl (raw codestream)
  if (head.startsWith('\x00\x00\x00\x0cJXL')) return true // jxl (container)
  if (head.startsWith('\x00\x00\x00\x0cjP  ')) return true // jpeg 2000
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0x00) ||
      (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0x00 && b[3] === 0x2a)) return true // tiff
  return false
}

async function localDataStart(file, entry) {
  const lh = new DataView(await file.slice(entry.localOffset, entry.localOffset + 30).arrayBuffer())
  if (lh.getUint32(0, true) !== LFH_SIG) throw new Error('Corrupt local header')
  const nameLen = lh.getUint16(26, true)
  const extraLen = lh.getUint16(28, true)
  return entry.localOffset + 30 + nameLen + extraLen
}

/**
 * Decompress only the first ~n bytes of an entry (the stream is cancelled
 * right after, so huge pages cost almost nothing to sniff).
 */
async function peekBytes(file, entry, n = 16) {
  try {
    if (entry.flags & 0x1) return null // encrypted
    const start = await localDataStart(file, entry)
    const raw = file.slice(start, start + entry.compSize)
    if (entry.method === 0) return new Uint8Array(await raw.slice(0, n).arrayBuffer())
    if (entry.method !== 8) return null
    const stream = raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))
    const reader = stream.getReader()
    const { value } = await reader.read()
    reader.cancel().catch(() => {})
    return value || null
  } catch {
    return null
  }
}

/** True when the archive looks like a RAR/CBR or 7z in disguise. */
async function foreignArchiveError(file) {
  const head = new Uint8Array(await file.slice(0, 8).arrayBuffer())
  const ascii = String.fromCharCode.apply(null, head)
  if (ascii.startsWith('Rar!\u001a\u0007')) {
    return 'This is a RAR/CBR archive — convert it to CBZ first (Komga can do this)'
  }
  if (ascii.startsWith('7z\u00bc\u00af\u0027\u001c')) {
    return 'This is a 7-Zip archive — re-save it as a ZIP/CBZ'
  }
  return null
}

/**
 * Open a ZIP/CBZ file (a File or Blob).
 * Returns { entries, pages, read } where `pages` is the naturally-sorted list
 * of image entries and `read(entryOrName)` returns a Blob of that entry.
 */
export async function openZip(file) {
  const foreign = await foreignArchiveError(file)
  if (foreign) throw new Error(foreign)

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
  let pages = entries.filter((e) => isImageEntry(e.name))

  // Entries that could plausibly be pages (used to sanity-check the filter).
  const candidates = entries.filter(
    (e) =>
      !e.name.endsWith('/') &&
      !e.name.includes('__MACOSX') &&
      !e.name.split('/').pop().startsWith('.') &&
      e.compSize > 8,
  )

  // Trust the extension filter only when it clearly explains the archive.
  // Otherwise (extension-less page names, odd formats, mixed dumps) fall
  // back to sniffing magic bytes — cheap, since only the first few bytes of
  // each entry get decompressed.
  if (pages.length < 3 || pages.length < candidates.length * 0.5) {
    const sniffed = []
    for (const e of candidates.slice(0, 500)) {
      const head = await peekBytes(file, e)
      if (head && looksLikeImageBytes(head)) sniffed.push(e)
    }
    if (sniffed.length > pages.length) {
      // merge in any extension matches the sniffer can't confirm (e.g. svg)
      const byName = new Map(sniffed.map((e) => [e.name, e]))
      for (const e of pages) if (!byName.has(e.name)) byName.set(e.name, e)
      pages = [...byName.values()]
    }
  }

  pages.sort((a, b) => coll.compare(a.name, b.name))

  async function read(entry) {
    if (typeof entry === 'string') entry = entries.find((e) => e.name === entry)
    if (!entry) throw new Error('Entry not found: ' + entry)
    if (entry.flags & 0x1) throw new Error('Archive is password-protected')
    if (entry.method !== 0 && entry.method !== 8) {
      throw new Error('Unsupported compression method ' + entry.method)
    }
    const start = await localDataStart(file, entry)
    const raw = file.slice(start, start + entry.compSize)
    if (entry.method === 0) return raw
    const ds = new DecompressionStream('deflate-raw')
    return new Response(raw.stream().pipeThrough(ds)).blob()
  }

  return { entries, pages, read }
}
