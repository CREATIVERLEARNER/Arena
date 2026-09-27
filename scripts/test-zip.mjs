// Smoke test for the CBZ/ZIP reader under Node.
// Creates a .cbz with Python (stored + deflated entries, ComicInfo.xml),
// then parses it with src/lib/zip.js.

import { openZip, looksLikeImageBytes } from '../src/lib/zip.js'
import { openComic, parseFilename } from '../src/lib/importer.js'
import { execSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import assert from 'node:assert'

const dir = '/tmp/brtest'
execSync(`rm -rf ${dir} && mkdir -p ${dir}`)

// minimal 1x1 red PNG
const png = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080200000090775' +
    '3de0000000c4944415408d763f8cfc00000030101cf34cc6a0000000049454e44ae426082',
  'hex',
)

// Build the CBZ: 001.jpg … 005.jpg (mix of stored/deflated) + ComicInfo.xml
execSync(`python3 - <<'EOF'
import zipfile, os
d = '${dir}'
png = bytes.fromhex('${png.toString('hex')}')
with zipfile.ZipFile(os.path.join(d, 'test.cbz'), 'w') as z:
    for i in range(1, 6):
        name = f'scan_{i:03d}.png'
        method = zipfile.ZIP_STORED if i % 2 else zipfile.ZIP_DEFLATED
        z.writestr(zipfile.ZipInfo(name), png, compress_type=method)
    z.writestr('ComicInfo.xml', '<?xml version="1.0"?><ComicInfo><Series>Neon Samurai</Series><Number>3</Number><Writer>K. Ishikawa</Writer><PageCount>5</PageCount></ComicInfo>')
# a corrupt file (not a zip)
open(os.path.join(d, 'bad.cbz'), 'wb').write(b'this is not a zip at all...........')
# a rar renamed to .cbz
open(os.path.join(d, 'fake.cbz'), 'wb').write(bytes([0x52, 0x61, 0x72, 0x21, 0x1a, 0x07, 0x01, 0x00]) + bytes(40))
# extension-less pages (some scanlation releases) + an odd extension
with zipfile.ZipFile(os.path.join(d, 'noext.cbz'), 'w') as z:
    for i in range(1, 4):
        method = zipfile.ZIP_STORED if i % 2 else zipfile.ZIP_DEFLATED
        z.writestr(zipfile.ZipInfo(f'{i:03d}'), png, compress_type=method)
    z.writestr('cover.jp2', png)
# a zip that just wraps an inner cbz
with zipfile.ZipFile(os.path.join(d, 'inner.cbz'), 'w') as z:
    z.writestr('page_001.png', png)
    z.writestr('ComicInfo.xml', '<ComicInfo><Series>Wrapped</Series><Number>1</Number></ComicInfo>')
with zipfile.ZipFile(os.path.join(d, 'nested.cbz'), 'w') as z:
    z.writestr('My Comic v01.cbz', open(os.path.join(d, 'inner.cbz'), 'rb').read())
EOF`)

const file = new File([readFileSync(`${dir}/test.cbz`)], 'test.cbz')

// ── happy path ──
const zip = await openZip(file)
assert.equal(zip.entries.length, 6, 'six entries')
assert.equal(zip.pages.length, 5, 'five image pages')
assert.equal(zip.pages[0].name, 'scan_001.png', 'natural page order')
assert.ok(zip.entries.some((e) => e.name === 'ComicInfo.xml'), 'comicinfo present')

const blob = await zip.read(zip.pages[1]) // deflated entry
const buf = Buffer.from(await blob.arrayBuffer())
assert.equal(buf.length, png.length, 'deflated entry size matches')
assert.ok(buf.equals(png), 'deflated entry bytes match')

const stored = await zip.read(zip.pages[0])
assert.ok(Buffer.from(await stored.arrayBuffer()).equals(png), 'stored entry bytes match')

const xml = await (await zip.read('ComicInfo.xml')).text()
assert.match(xml, /<Series>Neon Samurai<\/Series>/, 'comicinfo readable')

// ── error paths ──
const bad = new File([readFileSync(`${dir}/test.cbz`).subarray(0, 40)], 'truncated.cbz')
await assert.rejects(() => openZip(bad), /Not a ZIP/, 'truncated file rejected')
const notZip = new File([readFileSync(`${dir}/bad.cbz`)], 'bad.cbz')
await assert.rejects(() => openZip(notZip), /Not a ZIP/, 'non-zip rejected')
const fakeRar = new File([readFileSync(`${dir}/fake.cbz`)], 'fake.cbz')
await assert.rejects(() => openZip(fakeRar), /RAR\/CBR/, 'renamed rar gets a clear message')

// ── magic-byte sniffing (extension-less pages) ──
assert.ok(looksLikeImageBytes(new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0, 0])), 'jpeg magic')
assert.ok(!looksLikeImageBytes(new Uint8Array([0x00, 0x01, 0x02, 0x03])), 'random bytes not an image')
{
  const noext = new File([readFileSync(`${dir}/noext.cbz`)], 'noext.cbz')
  const zip = await openZip(noext)
  assert.equal(zip.pages.length, 4, 'extension-less pages found by sniffing (incl. .jp2)')
  assert.equal(zip.pages[0].name, '001', 'natural order preserved')
  const first = await zip.read(zip.pages[1]) // deflated, sniffed
  assert.ok(Buffer.from(await first.arrayBuffer()).equals(png), 'sniffed deflated entry reads fine')
}

// ── nested archives: a zip wrapping a cbz ──
{
  const nested = new File([readFileSync(`${dir}/nested.cbz`)], 'nested.cbz')
  const zip = await openComic(nested)
  assert.equal(zip.pages.length, 1, 'inner cbz pages found')
  assert.ok(zip.entries.some((e) => e.name.toLowerCase().includes('comicinfo.xml')), 'inner comicinfo visible')
}

// ── a zip with genuinely no images still errors, with a helpful message ──
{
  execSync(`python3 -c "import zipfile; zipfile.ZipFile('${dir}/empty.cbz','w').writestr('notes.txt','hi')"`)
  const empty = new File([readFileSync(`${dir}/empty.cbz`)], 'empty.cbz')
  await assert.rejects(() => openComic(empty), /No images inside — contains notes.txt/, 'helpful no-images error')
}

rmSync(dir, { recursive: true, force: true })
console.log('✓ zip.js: all checks passed (entries, order, stored, deflate, sniffing, nested, errors)')
