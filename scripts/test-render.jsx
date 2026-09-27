// Render smoke test: SSR every view with a mock context to catch
// render-time crashes (undefined vars, bad hooks, bad props).
// Built with esbuild (see package.json test:render) and run under Node.

import React from 'react'
import { renderToString } from 'react-dom/server'
import { AppCtx } from '../src/context.js'
import RoomView from '../src/components/RoomView.jsx'
import ShelfView from '../src/components/ShelfView.jsx'
import BookModal from '../src/components/BookModal.jsx'
import { SettingsDialog, HelpDialog, ShelfSettingsDialog, ImportOverlay } from '../src/components/Dialogs.jsx'
import { Toasts, ContextMenu, CoverArt, BookChip, Stars } from '../src/components/ui.jsx'
import { defaultState, addShelf, addBooks, moveBooks } from '../src/state.js'

// ── fixture ──
let s = defaultState()
s = addShelf(s, { id: 's1', name: 'Manga', x: 100, width: 620, rows: 3, sortMode: 'custom' })
s = addShelf(s, { id: 's2', name: 'To read', x: 900, width: 460, rows: 2, sortMode: 'series', viewMode: 'covers' })
s = addBooks(s, [
  { id: 'b1', title: 'Neon Samurai 1', series: 'Neon Samurai', number: 1, author: 'K. Ishikawa', rating: 5, status: 'read', pages: 210, tags: ['sci-fi'], coverId: null },
  { id: 'b2', title: 'Neon Samurai 2', series: 'Neon Samurai', number: 2, author: 'K. Ishikawa', rating: 4, status: 'reading', pages: 190 },
  { id: 'b3', title: 'Glass Gardens 1', series: 'Glass Gardens', number: 1, author: 'A. Mori', rating: 3, status: 'unread', pages: 160 },
  { id: 'b4', title: 'Loose one', series: '', number: null, author: '', rating: 0, status: 'unread', pages: null },
  { id: 'b5', title: 'Loose two', series: '', number: null, author: '', rating: 0, status: 'unread', pages: null },
])
s = moveBooks(s, ['b1', 'b2', 'b3'], 's1')

const noop = () => {}
const actions = new Proxy(
  {
    createShelf: () => 'x', openRoom: noop, openShelf: noop, openLoose: noop,
    openBook: noop, newBook: noop, closeBook: noop, updateBook: noop,
    updateShelf: noop, deleteShelf: noop, moveBooks: noop, deleteBooks: noop,
    setShelfSort: noop, saveView: noop, loadSample: noop, openShelfSettings: noop,
    openSettings: noop, openHelp: noop, exportData: noop, importData: noop,
    resetAll: noop, importFiles: noop, replaceCover: noop, clearImage: noop,
  },
  { get: (t, k) => (k in t ? t[k] : noop) },
)
const ctx = {
  state: s,
  setState: noop,
  view: { kind: 'room' },
  setView: noop,
  actions,
  toast: noop,
  confirm: async () => true,
  openMenu: noop,
  openBook: noop,
}

const cases = {
  'RoomView': <RoomView />,
  'ShelfView (custom shelf)': <ShelfView kind="shelf" shelfId="s1" />,
  'ShelfView (sorted shelf, covers)': <ShelfView kind="shelf" shelfId="s2" />,
  'ShelfView (missing shelf)': <ShelfView kind="shelf" shelfId="gone" />,
  'ShelfView (loose, spines)': <ShelfView kind="loose" />,
  'BookModal (edit)': <BookModal mode="edit" bookId="b1" onClose={noop} />,
  'BookModal (new)': <BookModal mode="new" shelfId="s1" onClose={noop} />,
  'SettingsDialog': <SettingsDialog onClose={noop} />,
  'HelpDialog': <HelpDialog onClose={noop} />,
  'ShelfSettingsDialog': <ShelfSettingsDialog shelfId="s1" onClose={noop} />,
  'ImportOverlay (running)': <ImportOverlay data={{ phase: 'running', items: [{ id: 'i1', name: 'a.cbz', status: 'working', detail: '' }, { id: 'i2', name: 'b.cbz', status: 'error', detail: 'boom' }], summary: null }} onClose={noop} onUndo={noop} />,
  'ImportOverlay (done)': <ImportOverlay data={{ phase: 'done', items: [{ id: 'i1', name: 'a.cbz', status: 'done', detail: 'Neon Samurai · 3' }], summary: { imported: 1, skipped: 0, failed: 0, others: 0 }, undo: { ids: ['x'], coverIds: [] } }} onClose={noop} onUndo={noop} />,
  'Toasts + Menu': <><Toasts toasts={[{ id: 't1', msg: 'hi', action: { label: 'Undo', fn: noop } }]} /><ContextMenu menu={{ x: 10, y: 10, items: [{ label: 'a', onClick: noop }, '-', { label: 'b', danger: true, disabled: true }] }} onClose={noop} /></>,
  'CoverArt generated': <CoverArt book={s.books[0]} className="x" style={{ width: 120, height: 180 }} />,
  'BookChip': <BookChip book={s.books[1]} coverUrl={null} />,
  'Stars': <Stars value={3} onChange={noop} />,
}

let failed = 0
for (const [name, el] of Object.entries(cases)) {
  try {
    const html = renderToString(<AppCtx.Provider value={ctx}>{el}</AppCtx.Provider>)
    if (!html || html.length < 10) throw new Error('empty render')
    console.log('✓', name, `(${html.length} chars)`)
  } catch (err) {
    failed++
    console.error('✗', name, '→', err.message)
  }
}
if (failed) {
  console.error(failed + ' render failures')
  process.exit(1)
}
console.log('✓ all views render without crashing')
