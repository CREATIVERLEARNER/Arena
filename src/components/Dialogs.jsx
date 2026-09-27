import React, { useEffect, useRef, useState } from 'react'
import { useApp } from '../context.js'
import { Modal } from './ui.jsx'
import { WOODS, MIN_W, MAX_W, shelfStats } from '../state.js'
import { fmtBytes, storageEstimate } from '../lib/db.js'

// ── bookcase options ──────────────────────────────────────────────────────

export function ShelfSettingsDialog({ shelfId, onClose }) {
  const { state, actions, confirm, toast } = useApp()
  const shelf = state.shelves.find((s) => s.id === shelfId)
  if (!shelf) return null
  const stats = shelfStats(state, shelf.id)

  return (
    <Modal title="Bookcase options" onClose={onClose}>
      <label className="field">
        <span>Name</span>
        <input
          value={shelf.name}
          onChange={(e) => actions.updateShelf(shelf.id, { name: e.target.value })}
          onKeyDown={(e) => e.key === 'Enter' && e.target.blur()}
        />
      </label>

      <div className="field-row">
        <div className="field">
          <span>Rows of shelves</span>
          <div className="stepper">
            <button className="icon-btn" onClick={() => actions.updateShelf(shelf.id, { rows: Math.max(1, shelf.rows - 1) })}>−</button>
            <b>{shelf.rows}</b>
            <button className="icon-btn" onClick={() => actions.updateShelf(shelf.id, { rows: Math.min(6, shelf.rows + 1) })}>＋</button>
          </div>
        </div>
        <div className="field">
          <span>Width</span>
          <input
            type="range"
            min={MIN_W}
            max={MAX_W}
            step={20}
            value={shelf.width}
            onChange={(e) => actions.updateShelf(shelf.id, { width: parseInt(e.target.value, 10) })}
          />
          <div className="hint">{shelf.width}px · holds roughly {Math.floor((shelf.width - 40) / 21)} books per row</div>
        </div>
      </div>

      <div className="field">
        <span>Wood</span>
        <div className="swatches">
          {Object.entries(WOODS).map(([key, w]) => (
            <button
              key={key}
              className={'swatch wood' + (shelf.wood === key ? ' on' : '')}
              style={{ background: w.face }}
              title={w.label}
              onClick={() => actions.updateShelf(shelf.id, { wood: key })}
            />
          ))}
        </div>
      </div>

      <div className="shelf-stats-line">
        {stats.total} books · {stats.read} read
      </div>

      <div className="shelf-settings-danger">
        <button
          className="btn btn-danger"
          onClick={async () => {
            const ok = await confirm(
              `Delete “${shelf.name}”? Its ${stats.total} books will move to Loose Books.`,
              { okLabel: 'Delete bookcase', danger: true },
            )
            if (ok) {
              actions.deleteShelf(shelf.id, false)
              actions.openRoom()
              onClose()
              toast('Bookcase deleted — books are in Loose Books')
            }
          }}
        >
          Delete bookcase…
        </button>
        <button
          className="btn btn-ghost"
          onClick={async () => {
            const ok = await confirm(
              `Delete “${shelf.name}” AND its ${stats.total} books permanently?`,
              { okLabel: 'Delete everything', danger: true },
            )
            if (ok) {
              actions.deleteShelf(shelf.id, true)
              actions.openRoom()
              onClose()
              toast('Bookcase and books deleted')
            }
          }}
        >
          Delete bookcase + books…
        </button>
      </div>
    </Modal>
  )
}

// ── settings ──────────────────────────────────────────────────────────────

export function SettingsDialog({ onClose }) {
  const { actions, state } = useApp()
  const [usage, setUsage] = useState(null)
  const importRef = useRef(null)

  useEffect(() => {
    storageEstimate().then(setUsage)
  }, [])

  return (
    <Modal title="Settings" onClose={onClose}>
      <h3 className="settings-h">Your data</h3>
      <p className="muted">
        Everything lives in this browser (IndexedDB). Comics are read once at import — only the small
        cover and details are kept, so even a huge library stays light: <b>{fmtBytes(usage?.usage)}</b> used.
      </p>
      <div className="btn-row">
        <button className="btn" onClick={actions.exportData}>⇩ Export backup (.json)</button>
        <button className="btn" onClick={() => importRef.current?.click()}>⇧ Restore / merge backup</button>
        <input
          ref={importRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) actions.importData(f)
            e.target.value = ''
          }}
        />
      </div>

      <h3 className="settings-h">Danger zone</h3>
      <button
        className="btn btn-danger"
        onClick={async () => {
          const ok = await confirm(
            `Wipe the whole library (${state.shelves.length} bookcases, ${state.books.length} books)? This cannot be undone.`,
            { okLabel: 'Wipe everything', danger: true },
          )
          if (ok) {
            await actions.resetAll()
            onClose()
          }
        }}
      >
        Reset Bookroom…
      </button>

      <h3 className="settings-h">About</h3>
      <p className="muted">
        <b>Bookroom</b> 1.0 — a cozy 2D home for your comics, inspired by games like Boxroom.
        Pair it with Komga for reading; use this for the shelf-and-room view Komga never gave you.
      </p>
    </Modal>
  )
}

// ── help ──────────────────────────────────────────────────────────────────

export function HelpDialog({ onClose }) {
  return (
    <Modal title="How Bookroom works" onClose={onClose}>
      <div className="help-cols">
        <div>
          <h4>The room</h4>
          <ul>
            <li><b>Drag empty space</b> to pan, <b>scroll</b> to zoom (pinch works too).</li>
            <li><b>Drag a bookcase</b> to move it — edges snap together.</li>
            <li><b>Click a bookcase</b> to open it; <b>right-click</b> for options.</li>
            <li>Drag a bookcase’s <b>edges</b> to make it wider or narrower.</li>
            <li><b>Search</b> filters shelves by name and by the books inside.</li>
          </ul>
          <h4>Shelves</h4>
          <ul>
            <li>Toggle between <b>spines</b> and <b>covers</b> in the shelf view.</li>
            <li><b>Drag spines</b> to arrange by hand (custom order), or pick a sort — series &amp; volume, author, favourites, read status…</li>
            <li>Dragging on a sorted shelf switches it to custom order.</li>
            <li><b>Right-click a book</b> for quick actions: mark read, move, delete.</li>
            <li>Hover a spine for details; small <i>dot</i> = unread, <i>gold band</i> = 4★+.</li>
          </ul>
        </div>
        <div>
          <h4>Importing</h4>
          <ul>
            <li><b>Drop .cbz / .zip files anywhere</b> — covers, titles, series and volume numbers are pulled automatically (from ComicInfo.xml when present, otherwise the filename).</li>
            <li>Books go onto the <b>shelf you're looking at</b> when you drop them; from the room they go to <b>Loose books</b> — tick them there and move them to any shelf in bulk.</li>
            <li>Re-importing the same file is skipped automatically.</li>
            <li>.cbr (RAR) isn’t supported — convert to .cbz first.</li>
          </ul>
          <h4>Shortcuts</h4>
          <ul>
            <li><kbd>/</kbd> search · <kbd>n</kbd> new bookcase · <kbd>0</kbd> fit view · <kbd>+ / −</kbd> zoom · <kbd>Esc</kbd> back</li>
          </ul>
          <h4>Your data</h4>
          <ul>
            <li>Stored only in this browser. Use <b>Settings → Export backup</b> to move it elsewhere.</li>
          </ul>
        </div>
      </div>
    </Modal>
  )
}

// ── import progress panel ─────────────────────────────────────────────────

export function ImportOverlay({ data, onClose, onUndo, onShelve }) {
  const { state } = useApp()
  const done = data.phase === 'done'
  const loose = done && data.summary?.destination === 'Loose Books' && data.summary.imported > 0
  return (
    <div className="import-panel">
      <div className="import-head">
        <b>{done ? 'Import finished' : 'Importing comics…'}</b>
        {!done && <span className="spinner" />}
        <span className="import-count">
          {data.items.filter((i) => ['done', 'skipped', 'error'].includes(i.status)).length}/{data.items.length}
        </span>
        <button className="icon-btn" onClick={onClose} title={done ? 'Close' : 'Hide'}>✕</button>
      </div>
      <div className="import-list">
        {data.items.slice(0, 60).map((it) => (
          <div key={it.id} className={'import-item st-' + it.status}>
            <span className="import-name" title={it.name}>{it.name}</span>
            <span className="import-detail">
              {it.status === 'working' ? 'reading…'
                : it.status === 'done' ? it.detail
                : it.status === 'skipped' ? 'duplicate — skipped'
                : it.status === 'error' ? it.detail
                : ''}
            </span>
          </div>
        ))}
        {data.items.length > 60 && (
          <div className="import-item">… and {data.items.length - 60} more</div>
        )}
      </div>
      {done && data.summary && (
        <div className="import-summary">
          <span>
            <b>{data.summary.imported}</b> imported → <b>{data.summary.destination}</b>
            {data.summary.strays ? <> · {data.summary.strays} to Loose (no room)</> : null}
            {data.summary.skipped ? <> · {data.summary.skipped} duplicate{data.summary.skipped > 1 ? 's' : ''} skipped</> : null}
            {data.summary.failed ? <> · <b className="err">{data.summary.failed} failed</b></> : null}
          </span>
          <span className="spacer" />
          {data.undo && (
            <button className="btn btn-mini" onClick={() => onUndo(data.undo)}>Undo</button>
          )}
          {loose && state.shelves.length > 0 && (
            <select
              defaultValue=""
              onChange={(e) => {
                const v = e.target.value
                if (v) onShelve(v)
              }}
            >
              <option value="" disabled>Move all to…</option>
              {state.shelves.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          )}
          <button className="btn btn-mini btn-primary" onClick={onClose}>Done</button>
        </div>
      )}
    </div>
  )
}
