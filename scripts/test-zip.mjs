// Smoke test for the CBZ/ZIP reader under Node.
// Creates a .cbz with Python (stored + deflated entries, ComicInfo.xml),
// then parses it with src/lib/zip.js.

import { openZip } from '../src/lib/zip.js'
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

rmSync(dir, { recursive: true, force: true })
console.log('✓ zip.js: all checks passed (entries, order, stored, deflate, comicinfo, errors)')
