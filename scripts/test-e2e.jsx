// End-to-end "add a dummy book" test.
// Boots the real App in jsdom with a fake IndexedDB, then drives the UI the
// way a user would: create a bookcase → open it → fill the add-book form →
// verify the book appears on the shelf, on the bookcase in the room, and
// actually persists to storage.

import { JSDOM } from 'jsdom'
import { IDBFactory } from 'fake-indexeddb'
import { execSync } from 'node:child_process'
import { readFileSync, rmSync } from 'node:fs'
import assert from 'node:assert'

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {
  url: 'http://localhost/',
  pretendToBeVisual: true,
})

// install browser globals BEFORE importing the app
for (const k of ['window', 'document', 'HTMLElement', 'HTMLInputElement', 'Element', 'Node', 'CustomEvent', 'Event', 'MouseEvent', 'KeyboardEvent', 'getComputedStyle']) {
  globalThis[k] = dom.window[k]
}
try {
  Object.defineProperty(globalThis, 'navigator', { value: dom.window.navigator, configurable: true })
} catch { /* Node's own navigator is fine — we only use optional features */ }
globalThis.indexedDB = new IDBFactory()
globalThis.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} }
globalThis.IS_REACT_ACT_ENVIRONMENT = true

const { act } = await import('react')
const { createRoot } = await import('react-dom/client')
const { default: App } = await import('../src/App.jsx')
const { loadState } = await import('../src/lib/db.js')

// ── tiny helpers ──────────────────────────────────────────────────────────
const $ = (sel) => document.querySelector(sel)
const $$ = (sel) => [...document.querySelectorAll(sel)]
const byText = (sel, text) => $$(sel).find((el) => el.textContent.includes(text))
const click = (el) => el && act(() => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true })))
const press = (el, type, opts = {}) =>
  act(() => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: 0, ...opts })))
const typeInto = (input, value) =>
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set
    setter.call(input, value)
    input.dispatchEvent(new Event('input', { bubbles: true }))
  })
const flush = (ms = 60) => act(async () => { await new Promise((r) => setTimeout(r, ms)) })
async function waitFor(fn, ms = 4000, what = '') {
  const t0 = Date.now()
  while (Date.now() - t0 < ms) {
    try { const v = fn(); if (v) return v } catch { /* keep waiting */ }
    await flush(40)
  }
  throw new Error('timed out waiting for: ' + (what || fn))
}

// ── boot ──────────────────────────────────────────────────────────────────
const root = createRoot(document.getElementById('root'))
await act(async () => { root.render(<App />) })
await waitFor(() => $('.empty-state'), 4000, 'empty room')
console.log('✓ app booted — empty room with welcome card')

// ── 1. create a bookcase ─────────────────────────────────────────────────
await click(byText('.hud-top button', 'Bookcase'))
await waitFor(() => $('.bookcase'), 2000, 'bookcase to appear')
console.log('✓ clicked “＋ Bookcase” — a bookcase stands in the room')

// ── 2. open it (press + release without moving = click) ──────────────────
press($('.bookcase'), 'pointerdown', { clientX: 200, clientY: 300 })
await act(async () => { dom.window.dispatchEvent(new MouseEvent('pointerup', { button: 0, clientX: 200, clientY: 300 })) })
await waitFor(() => $('.sv-head'), 2000, 'shelf view to open')
console.log('✓ clicked the bookcase — shelf view opened')

// ── 3. add a dummy book through the form ─────────────────────────────────
await click(byText('.sv-head button', 'Add book'))
await waitFor(() => $('.modal'), 2000, 'add-book modal')
await typeInto($('.modal .bm-right .field input'), 'Dummy Book')
await click(byText('.bm-actions button', 'Add book'))
await waitFor(() => !$('.modal'), 2000, 'modal to close')
console.log('✓ filled in “Dummy Book” and clicked Add book')

// ── 4. it shows on the shelf ─────────────────────────────────────────────
await waitFor(() => $('.spine'), 2000, 'spine on the shelf')
assert.ok($('.spine').textContent.includes('Dummy Book'), 'spine shows the title')
assert.match($('.sv-stats').textContent, /1 book/, 'stats count it')
assert.match($('.toast').textContent, /Book added to/, 'toast says where it went')
console.log('✓ spine rendered on the shelf — toast: “' + $('.toast').textContent.trim() + '”')

// ── 5. back to the room — it shows on the bookcase ───────────────────────
await act(async () => { dom.window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })) })
await waitFor(() => $('.bookcase') && !$('.sv-head'), 2000, 'room view')
assert.ok($('.bc-spine'), 'mini spine rendered on the bookcase')
console.log('✓ back in the room — the bookcase shows its spine')

// ── 6. import a dummy CBZ from the room (should land in Loose Books) ─────
{
  const dir = '/tmp/bookroom-e2e'
  execSync(`rm -rf ${dir} && mkdir -p ${dir} && python3 - <<'EOF'
import zipfile
png = bytes.fromhex('89504e470d0a1a0a0000000d494844520000000100000001080200000090775' + '3de0000000c4944415408d763f8cfc00000030101cf34cc6a0000000049454e44ae426082')
with zipfile.ZipFile('${dir}/Dummy Series v01.cbz', 'w') as z:
    z.writestr('001.png', png)
    z.writestr('002.png', png)
    z.writestr('ComicInfo.xml', '<ComicInfo><Series>Dummy Series</Series><Number>1</Number><Writer>Test Author</Writer></ComicInfo>')
EOF`)
  const buf = readFileSync(`${dir}/Dummy Series v01.cbz`)
  const cbz = new File([buf], 'Dummy Series v01.cbz') // node's File — same Blob API the app expects

  const input = $('.room input[type="file"]')
  assert.ok(input, 'room has a hidden import input')
  Object.defineProperty(input, 'files', { value: [cbz], configurable: true })
  await act(async () => { input.dispatchEvent(new Event('change', { bubbles: true })) })

  await waitFor(() => $('.import-panel'), 2000, 'import panel')
  await waitFor(() => $('.import-summary'), 6000, 'import to finish')
  assert.match($('.import-summary').textContent, /1 imported/, 'one book imported')
  assert.match($('.import-summary').textContent, /Loose Books/, 'went to Loose Books')
  await click(byText('.import-panel button', 'Done'))
  console.log('✓ dropped “Dummy Series v01.cbz” — imported → Loose Books')

  // open Loose books and see it
  await click(byText('.hud-top button', 'Loose books'))
  await waitFor(() => $('.loose-wrap'), 2000, 'loose books view')
  assert.ok(
    $$('.loose-wrap .spine').some((s) => s.textContent.includes('Dummy Series')),
    'imported spine visible in Loose books',
  )
  console.log('✓ imported book is sitting in Loose books, ready to shelve')
  rmSync(dir, { recursive: true, force: true })
}

// ── 7. it persisted to IndexedDB ─────────────────────────────────────────
await flush(700) // save is debounced at 350ms
const saved = await loadState()
assert.equal(saved.books.length, 2, 'manual book + imported book saved')
const manual = saved.books.find((b) => b.title === 'Dummy Book')
const imported = saved.books.find((b) => (b.series || '') === 'Dummy Series')
assert.ok(manual && manual.shelfId === saved.shelves[0].id, 'manual book saved on the bookcase')
assert.ok(imported && !imported.shelfId, 'imported book saved in Loose books')
assert.equal(imported.number, 1, 'volume number parsed from ComicInfo/filename')
console.log('✓ persisted: “Dummy Book” on bookcase “' + saved.shelves[0].name + '”, “Dummy Series 1” in Loose Books')

await act(async () => { root.unmount() })
console.log('\n✓ e2e: adding a dummy book works end to end')
