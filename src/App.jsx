import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AppCtx } from './context.js'
import * as db from './lib/db.js'
import { uid, download } from './lib/util.js'
import { shrinkImage } from './lib/importer.js'
import { collectFiles, isCbzFile, importCbz } from './lib/importer.js'
import {
  defaultState, addShelf, updateShelf, deleteShelf, updateBook,
  deleteBooks, moveBooks as moveBooksPure, materializeLayout, blobIdsOf,
  importToShelf,
} from './state.js'
import { withSampleLibrary } from './lib/sample.js'
import RoomView from './components/RoomView.jsx'
import ShelfView from './components/ShelfView.jsx'
import BookModal from './components/BookModal.jsx'
import { SettingsDialog, HelpDialog, ShelfSettingsDialog, ImportOverlay } from './components/Dialogs.jsx'
import { ContextMenu, Toasts } from './components/ui.jsx'

const dupKey = (b) =>
  ((b.series || '') + '|' + (b.number ?? '') + '|' + (b.title || '')).toLowerCase()

function blobToDataURL(blob) {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res(r.result)
    r.onerror = rej
    r.readAsDataURL(blob)
  })
}

function dataURLToBlob(url) {
  const [head, body] = url.split(',')
  const mime = /:(.*?);/.exec(head)?.[1] || 'image/jpeg'
  const bin = atob(body)
  const arr = new Uint8Array(bin.length)
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i)
  return new Blob([arr], { type: mime })
}

export default function App() {
  const [state, setState] = useState(null) // null until IndexedDB is read
  const [view, setView] = useState({ kind: 'room' })
  const [toasts, setToasts] = useState([])
  const [menu, setMenu] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [editing, setEditing] = useState(null) // {mode:'edit', id} | {mode:'new', shelfId}
  const [shelfSettings, setShelfSettings] = useState(null) // shelf id
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [helpOpen, setHelpOpen] = useState(false)
  const [importing, setImporting] = useState(null)
  const [dropHint, setDropHint] = useState(false)

  const stateRef = useRef(null)
  useEffect(() => { stateRef.current = state }, [state])

  // ── boot ────────────────────────────────────────────────────────────────
  useEffect(() => {
    db.loadState()
      .then((s) => { setState(s || defaultState()) })
      .catch(() => setState(defaultState()))
  }, [])

  // debounced persistence
  useEffect(() => {
    if (!state) return
    const t = setTimeout(() => db.saveState(state).catch(() => {}), 350)
    return () => clearTimeout(t)
  }, [state])
  useEffect(() => {
    const flush = () => { if (stateRef.current) db.saveState(stateRef.current).catch(() => {}) }
    window.addEventListener('beforeunload', flush)
    document.addEventListener('visibilitychange', flush)
    return () => {
      window.removeEventListener('beforeunload', flush)
      document.removeEventListener('visibilitychange', flush)
    }
  }, [])

  // ── toasts / confirm / menu ─────────────────────────────────────────────
  const toast = useCallback((msg, opts = {}) => {
    const id = uid('t-')
    setToasts((ts) => [...ts.slice(-3), { id, msg, ...opts }])
    setTimeout(() => setToasts((ts) => ts.filter((t) => t.id !== id)), opts.timeout || 4200)
  }, [])

  const confirm = useCallback(
    (message, { okLabel = 'OK', danger = false } = {}) =>
      new Promise((resolve) => setConfirmState({ message, okLabel, danger, resolve })),
    [],
  )

  const openMenu = useCallback((items, x, y) => setMenu({ items, x, y }), [])

  // ── actions ─────────────────────────────────────────────────────────────
  const actions = useMemo(() => ({
    openRoom: () => setView({ kind: 'room' }),
    openShelf: (id) => setView({ kind: 'shelf', id }),
    openLoose: () => setView({ kind: 'loose' }),

    createShelf: (patch = {}) => {
      const id = uid('sh-')
      setState((s) => addShelf(s, { ...patch, id }))
      return id
    },
    updateShelf: (id, patch) => setState((s) => updateShelf(s, id, patch)),
    deleteShelf: (id, alsoDeleteBooks) =>
      setState((s) => {
        const books = s.books.filter((b) => b.shelfId === id)
        if (alsoDeleteBooks) blobIdsOf(books).forEach((bid) => db.delBlob(bid).catch(() => {}))
        return deleteShelf(s, id, alsoDeleteBooks)
      }),

    openBook: (id) => setEditing({ mode: 'edit', id }),
    newBook: (shelfId = null) => setEditing({ mode: 'new', shelfId }),
    closeBook: () => setEditing(null),

    updateBook: (id, patch) => setState((s) => updateBook(s, id, patch)),

    /** Swap (or clear) a book's cover with an image file. */
    replaceCover: async (book, file, which = 'cover') => {
      const shrunk = await shrinkImage(file, 640)
      const id = uid('cov-')
      await db.putBlob(id, shrunk)
      const oldId = which === 'cover' ? book.coverId : book.spineImageId
      setState((s) => updateBook(s, book.id, which === 'cover' ? { coverId: id } : { spineImageId: id }))
      if (oldId) db.delBlob(oldId).catch(() => {})
    },
    clearImage: (book, which) => {
      const oldId = which === 'cover' ? book.coverId : book.spineImageId
      setState((s) => updateBook(s, book.id, which === 'cover' ? { coverId: null } : { spineImageId: null }))
      if (oldId) db.delBlob(oldId).catch(() => {})
    },

    /** Move books to a shelf (or Loose when shelfId is null). */
    moveBooks: (ids, shelfId, spot = null) =>
      setState((s) => {
        const shelf = shelfId ? s.shelves.find((x) => x.id === shelfId) : null
        // A drop with an exact spot is a drag-reorder *within* one shelf —
        // bake the on-screen arrangement in first so the insertion matches
        // what the user sees (this is also what switches sort → custom).
        const reorderWithin =
          shelf && spot && ids.every((id) => s.books.find((b) => b.id === id)?.shelfId === shelfId)
        if (reorderWithin) s = materializeLayout(s, shelf)
        return moveBooksPure(s, ids, shelfId, spot)
      }),

    deleteBooks: (ids) =>
      setState((s) => {
        const books = s.books.filter((b) => ids.includes(b.id))
        blobIdsOf(books).forEach((bid) => db.delBlob(bid).catch(() => {}))
        return deleteBooks(s, ids)
      }),

    setShelfSort: (shelfId, sortMode, reverse) =>
      setState((s) => updateShelf(s, shelfId, { sortMode, reverse })),

    saveView: (v) =>
      setState((s) => ({ ...s, settings: { ...s.settings, view: v } })),

    loadSample: () => setState((s) => withSampleLibrary(s)),

    openShelfSettings: (id) => setShelfSettings(id),
    openSettings: () => setSettingsOpen(true),
    openHelp: () => setHelpOpen(true),

    // ── backup ──
    exportData: async () => {
      const s = stateRef.current
      const blobs = await db.allBlobs()
      const covers = {}
      for (const b of blobs) covers[b.id] = await blobToDataURL(b.blob)
      const json = {
        app: 'bookroom', version: 1, exportedAt: new Date().toISOString(),
        state: s, covers,
      }
      const date = new Date().toISOString().slice(0, 10)
      download(`bookroom-backup-${date}.json`, new Blob([JSON.stringify(json)], { type: 'application/json' }))
    },

    importData: async (file) => {
      try {
        const parsed = JSON.parse(await file.text())
        if (parsed.app !== 'bookroom' || !parsed.state) throw new Error('not a Bookroom backup')
        const incoming = parsed.state
        let addedShelves = 0, addedBooks = 0
        setState((s) => {
          let shelves = [...s.shelves]
          let books = [...s.books]
          const shelfIdMap = new Map()
          for (const sh of incoming.shelves || []) {
            if (shelves.some((x) => x.id === sh.id)) continue
            shelves.push(sh)
            shelfIdMap.set(sh.id, sh.id)
            addedShelves++
          }
          for (const b of incoming.books || []) {
            if (books.some((x) => x.id === b.id)) continue
            books.push(b)
            addedBooks++
          }
          return { ...s, shelves, books }
        })
        for (const [id, dataURL] of Object.entries(parsed.covers || {})) {
          const blob = dataURLToBlob(dataURL)
          db.putBlob(id, blob).catch(() => {})
        }
        toast(`Backup loaded — ${addedShelves} bookcases, ${addedBooks} books added`)
      } catch (err) {
        toast('Could not read that backup: ' + (err.message || 'invalid file'))
      }
    },

    resetAll: async () => {
      await db.wipeAll()
      setState(defaultState())
      setView({ kind: 'room' })
    },

    // ── CBZ import ──
    // With no explicit target, books go onto the shelf you're currently
    // looking at (if any), otherwise to Loose Books.
    importFiles: async (fileList, targetShelfId = null) => {
      const all = Array.from(fileList || [])
      const files = all.filter(isCbzFile)
      if (!files.length) {
        toast('No .cbz / .zip files found — drop your comic archives to import them')
        return
      }
      const target = targetShelfId ?? (viewRef.current?.kind === 'shelf' ? viewRef.current.id : null)
      const targetShelf = target ? stateRef.current?.shelves.find((s) => s.id === target) : null
      const destination = targetShelf?.name || 'Loose Books'
      const items = files.map((f) => ({ id: uid('im-'), name: f.name, status: 'pending', detail: '' }))
      setImporting({ phase: 'running', items, summary: null })
      const setItem = (i, patch) =>
        setImporting((cur) =>
          cur ? { ...cur, items: cur.items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } : cur,
        )

      const seen = new Set(stateRef.current.books.map(dupKey))
      const results = []
      let skipped = 0, failed = 0
      let idx = 0
      const worker = async () => {
        while (idx < files.length) {
          const i = idx++
          const f = files[i]
          setItem(i, { status: 'working' })
          try {
            const r = await importCbz(f)
            const key = dupKey(r.book)
            if (seen.has(key)) {
              skipped++
              setItem(i, { status: 'skipped', detail: 'already in your library' })
              continue
            }
            seen.add(key)
            results.push(r)
            setItem(i, {
              status: 'done',
              detail: (r.book.series || r.book.title) + (r.book.number ? ' · ' + r.book.number : ''),
            })
          } catch (err) {
            failed++
            setItem(i, { status: 'error', detail: err.message || 'could not read' })
          }
        }
      }
      await Promise.all(Array.from({ length: 3 }, worker))

      const newBooks = []
      for (const r of results) {
        if (r.coverBlob && r.coverId) {
          try { await db.putBlob(r.coverId, r.coverBlob) } catch { /* keep book without cover */ }
        }
        newBooks.push({
          ...r.book,
          id: uid('bk-'),
          coverId: r.coverId || null,
          spineImageId: null,
          addedAt: Date.now(),
        })
      }
      let strays = 0
      if (newBooks.length) {
        // place onto the target shelf; whatever doesn't fit falls back to Loose
        setState((s) => importToShelf(s, newBooks, targetShelf ? target : null))
        const preview = importToShelf(stateRef.current, newBooks, targetShelf ? target : null)
        strays = newBooks.filter((b) => !preview.books.find((x) => x.id === b.id)?.shelfId).length
      }

      const summary = {
        imported: newBooks.length,
        strays,
        destination,
        skipped,
        failed,
        others: all.length - files.length,
      }
      const undo = newBooks.length
        ? {
            ids: newBooks.map((b) => b.id),
            coverIds: newBooks.map((b) => b.coverId).filter(Boolean),
          }
        : null
      setImporting((cur) => (cur ? { ...cur, phase: 'done', summary, undo } : cur))
      if (newBooks.length) {
        toast(
          destination === 'Loose Books'
            ? `Imported ${newBooks.length} → Loose Books`
            : `Imported ${newBooks.length} → “${destination}”${strays ? ` · ${strays} to Loose (no room)` : ''}`,
        )
      }
    },
  }), [toast])

  // ── global drag & drop import ───────────────────────────────────────────
  useEffect(() => {
    let depth = 0
    const hasFiles = (e) => Array.from(e.dataTransfer?.types || []).includes('Files')
    const onEnter = (e) => { if (hasFiles(e)) { depth++; setDropHint(true) } }
    const onOver = (e) => { if (hasFiles(e)) e.preventDefault() }
    const onLeave = () => { depth = Math.max(0, depth - 1); if (depth === 0) setDropHint(false) }
    const onDrop = async (e) => {
      if (!hasFiles(e)) return
      e.preventDefault()
      depth = 0
      setDropHint(false)
      const files = await collectFiles(e.dataTransfer)
      actions.importFiles(files)
    }
    window.addEventListener('dragenter', onEnter)
    window.addEventListener('dragover', onOver)
    window.addEventListener('dragleave', onLeave)
    window.addEventListener('drop', onDrop)
    return () => {
      window.removeEventListener('dragenter', onEnter)
      window.removeEventListener('dragover', onOver)
      window.removeEventListener('dragleave', onLeave)
      window.removeEventListener('drop', onDrop)
    }
  }, [actions])

  // global keyboard: "?" opens help
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '?') { e.preventDefault(); setHelpOpen((v) => !v) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  if (!state) {
    return (
      <div className="boot">
        <div className="boot-title">Bookroom</div>
        <div className="boot-sub">warming up the fireplace…</div>
      </div>
    )
  }

  const ctx = { state, setState, view, setView, actions, toast, confirm, openMenu, openBook: actions.openBook }

  return (
    <AppCtx.Provider value={ctx}>
      {view.kind === 'room' ? (
        <RoomView />
      ) : (
        <ShelfView kind={view.kind} shelfId={view.id} />
      )}

      {editing && (
        <BookModal
          mode={editing.mode}
          bookId={editing.id}
          targetShelfId={editing.shelfId}
          onClose={actions.closeBook}
        />
      )}
      {shelfSettings && <ShelfSettingsDialog shelfId={shelfSettings} onClose={() => setShelfSettings(null)} />}
      {settingsOpen && <SettingsDialog onClose={() => setSettingsOpen(false)} />}
      {helpOpen && <HelpDialog onClose={() => setHelpOpen(false)} />}
      {importing && (
        <ImportOverlay
          data={importing}
          onClose={() => setImporting(null)}
          onShelve={(shelfId) => {
            if (!importing.undo) return
            actions.moveBooks(importing.undo.ids, shelfId)
            setImporting(null)
            toast(`Moved to “${state.shelves.find((s) => s.id === shelfId)?.name || 'shelf'}”`)
          }}
          onUndo={async (undo) => {
            undo.coverIds.forEach((id) => db.delBlob(id).catch(() => {}))
            setState((s) => deleteBooks(s, undo.ids))
            setImporting(null)
            toast('Import undone')
          }}
        />
      )}
      {dropHint && (
        <div className="drop-hint">
          <div className="drop-hint-card">
            <div className="drop-hint-big">Drop to import</div>
            <div className="drop-hint-sub">.cbz / .zip comics — covers &amp; details are read automatically</div>
          </div>
        </div>
      )}
      {menu && <ContextMenu menu={menu} onClose={() => setMenu(null)} />}
      {confirmState && (
        <div className="overlay">
          <div className="modal modal-sm">
            <div className="modal-body confirm-body">{confirmState.message}</div>
            <div className="modal-foot">
              <button
                className="btn"
                onClick={() => { confirmState.resolve(false); setConfirmState(null) }}
              >
                Cancel
              </button>
              <button
                className={'btn ' + (confirmState.danger ? 'btn-danger' : 'btn-primary')}
                onClick={() => { confirmState.resolve(true); setConfirmState(null) }}
              >
                {confirmState.okLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      <Toasts toasts={toasts} />
    </AppCtx.Provider>
  )
}
