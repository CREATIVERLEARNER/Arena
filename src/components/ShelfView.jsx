import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context.js'
import { useBlobUrl, Modal, Stars, CoverArt, BookChip } from './ui.jsx'
import {
  SORTS, WOODS, layoutShelf, rowInnerW, thicknessOf, spineColorOf, contrastText,
  ROW_H, BOARD, shelfStats, bookLabel,
} from '../state.js'
import { clamp } from '../lib/util.js'

// ── one detailed spine (zoomed-in view) ───────────────────────────────────

function Spine({ book, scale, rowH, onDown, onMenu, onEnter, onLeave, dim, selected, checkbox }) {
  const spineUrl = useBlobUrl(book.spineImageId)
  const t = thicknessOf(book) * scale
  const color = spineColorOf(book)
  const text = contrastText(color)
  const hFactor = 0.9 + ((book.id.length * 7) % 10) / 100
  return (
    <div
      className={
        'spine' + (dim ? ' dim' : '') + (selected ? ' selected' : '') + (checkbox ? ' selectable' : '')
      }
      style={{ width: t, height: Math.round(rowH * hFactor), background: color, color: text }}
      onPointerDown={(e) => onDown?.(e, book)}
      onContextMenu={(e) => onMenu?.(e, book)}
      onMouseEnter={(e) => onEnter?.(e, book)}
      onMouseLeave={(e) => onLeave?.(e, book)}
      title=""
    >
      {spineUrl ? (
        <img src={spineUrl} alt="" draggable={false} />
      ) : (
        <>
          <span className="spine-bands" />
          <span className="spine-title" style={{ fontSize: clamp(t * 0.42, 9, 15) }}>
            {book.series || book.title}
            {book.number != null && book.number !== '' ? ' ' + book.number : ''}
          </span>
          {book.author && <span className="spine-author" style={{ fontSize: clamp(t * 0.3, 8, 11) }}>{book.author}</span>}
        </>
      )}
      {book.rating >= 4 && <i className="spine-fav" title="Favourite" />}
      {(book.status === 'unread' || book.status === 'reading') && (
        <i className={'spine-dot' + (book.status === 'reading' ? ' half' : '')} />
      )}
      {checkbox && (
        <button
          className={'spine-check' + (selected ? ' on' : '')}
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => { e.stopPropagation(); checkbox(book) }}
          title="Select"
        >
          ✓
        </button>
      )}
    </div>
  )
}

// ── one face-out cover ────────────────────────────────────────────────────

function Cover({ book, onOpen, onMenu, dim, selected, checkbox }) {
  const url = useBlobUrl(book.coverId)
  return (
    <div className={'cover' + (dim ? ' dim' : '') + (selected ? ' selected' : '')}>
      <div className="cover-wrap" onClick={() => onOpen(book)} onContextMenu={(e) => onMenu?.(e, book)}>
        <CoverArt book={book} coverUrl={url} className="cover-img" />
        {checkbox && (
          <button
            className={'spine-check' + (selected ? ' on' : '')}
            onClick={(e) => { e.stopPropagation(); checkbox(book) }}
            title="Select"
          >
            ✓
          </button>
        )}
      </div>
      <div className="cover-title">{book.title || book.series}</div>
      <div className="cover-sub">{bookLabel(book)}</div>
    </div>
  )
}

// ── move dialog (used by the spine context menu) ──────────────────────────

function MoveDialog({ ids, onClose }) {
  const { state, actions, toast } = useApp()
  const looseN = state.books.filter((b) => !b.shelfId).length
  return (
    <Modal title={`Move ${ids.length} book${ids.length > 1 ? 's' : ''}`} onClose={onClose}>
      <div className="move-list">
        <button
          className="move-item"
          onClick={() => { actions.moveBooks(ids, null); toast('Moved to Loose Books'); onClose() }}
        >
          <span className="move-icon">📦</span>
          <span>Loose books</span>
          <span className="move-count">{looseN}</span>
        </button>
        {state.shelves.map((s) => (
          <button
            key={s.id}
            className="move-item"
            onClick={() => { actions.moveBooks(ids, s.id); toast(`Moved to “${s.name}”`); onClose() }}
          >
            <span className="move-icon">▤</span>
            <span>{s.name}</span>
            <span className="move-count">{state.books.filter((b) => b.shelfId === s.id).length}</span>
          </button>
        ))}
      </div>
    </Modal>
  )
}

// ── the view itself ───────────────────────────────────────────────────────

export default function ShelfView({ kind, shelfId }) {
  const { state, actions, openMenu, confirm, toast } = useApp()
  const shelf = kind === 'shelf' ? state.shelves.find((s) => s.id === shelfId) : null
  const isLoose = kind === 'loose'

  const bodyRef = useRef(null)
  const impRef = useRef(null)
  const rowEls = useRef([])
  const caretEls = useRef([])
  const [scale, setScale] = useState(2.2)
  const [fq, setFq] = useState('')
  const [tip, setTip] = useState(null)
  const tipTimer = useRef(null)
  const [rename, setRename] = useState(false)
  const [moving, setMoving] = useState(null) // ids for MoveDialog
  const [selection, setSelection] = useState(() => new Set())
  const [looseSort, setLooseSort] = useState({ mode: 'added', reverse: true })
  const [looseView, setLooseView] = useState('spines')

  const books = useMemo(
    () => (isLoose ? state.books.filter((b) => !b.shelfId) : state.books.filter((b) => b.shelfId === shelfId)),
    [state, isLoose, shelfId],
  )
  const stats = useMemo(
    () => ({ total: books.length, read: books.filter((b) => b.status === 'read').length }),
    [books],
  )

  // leave gracefully if the shelf vanished
  useEffect(() => {
    if (kind === 'shelf' && !shelf) actions.openRoom()
  }, [kind, shelf, actions])

  // scale to fit the bookcase's width in the viewport
  useLayoutEffect(() => {
    const body = bodyRef.current
    if (!body) return
    const compute = () => {
      const w = body.clientWidth - 90
      if (isLoose) setScale(2.1)
      else if (shelf) setScale(clamp(w / shelf.width, 1.5, 2.8))
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(body)
    return () => ro.disconnect()
  }, [isLoose, shelf?.width])

  // Esc → back to the room
  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== 'Escape') return
      if (document.activeElement?.tagName === 'INPUT' || document.activeElement?.tagName === 'TEXTAREA') return
      actions.openRoom()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [actions])

  // ── layout ──────────────────────────────────────────────────────────────
  const layout = useMemo(
    () => (shelf ? layoutShelf(shelf, state.books) : { rows: [], overflow: [] }),
    [shelf, state],
  )

  const looseOrdered = useMemo(() => {
    if (!isLoose) return []
    const cmp = SORTS[looseSort.mode]?.cmp
    let list = [...books]
    if (cmp) list.sort(cmp)
    if (looseSort.reverse) list.reverse()
    return list
  }, [isLoose, books, looseSort])

  const qq = fq.trim().toLowerCase()
  const matchesFilter = (b) =>
    !qq || `${b.title || ''} ${b.series || ''} ${b.author || ''} ${(b.tags || []).join(' ')}`.toLowerCase().includes(qq)

  // ── tooltip ─────────────────────────────────────────────────────────────
  function showTip(e, book) {
    clearTimeout(tipTimer.current)
    const el = e.currentTarget
    tipTimer.current = setTimeout(() => {
      const r = el.getBoundingClientRect()
      const below = r.top < 240 // flip the tooltip under the spine near the top edge
      setTip({
        book,
        x: clamp(r.left + r.width / 2, 150, window.innerWidth - 150),
        y: below ? r.bottom : r.top,
        below,
      })
    }, 380)
  }
  function hideTip() {
    clearTimeout(tipTimer.current)
    setTip(null)
  }
  useEffect(() => () => clearTimeout(tipTimer.current), [])

  // ── drag & drop reordering (spines mode on a real shelf) ────────────────
  const drag = useRef(null)

  function onSpineDown(e, book) {
    if (e.button !== 0) return
    e.preventDefault()
    hideTip()
    const startX = e.clientX
    const startY = e.clientY
    let active = false
    const src = e.currentTarget

    const onMove = (ev) => {
      if (!active) {
        if (Math.hypot(ev.clientX - startX, ev.clientY - startY) < 5) return
        active = true
        beginDrag(book, src, ev)
      }
      moveDrag(ev)
    }
    const onUp = (ev) => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      if (!active) {
        actions.openBook(book.id)
        return
      }
      endDrag(ev)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function beginDrag(book, srcEl, ev) {
    const r = srcEl.getBoundingClientRect()
    const ghost = document.createElement('div')
    ghost.className = 'spine-ghost'
    ghost.style.width = r.width + 'px'
    ghost.style.height = r.height + 'px'
    ghost.style.background = spineColorOf(book)
    ghost.style.color = contrastText(spineColorOf(book))
    ghost.innerHTML = `<span class="spine-bands"></span><span class="spine-title" style="font-size:${clamp(r.width * 0.42, 9, 15)}px">${escapeHtml(
      (book.series || book.title) + (book.number != null && book.number !== '' ? ' ' + book.number : ''),
    )}</span>`
    document.body.appendChild(ghost)
    srcEl.classList.add('drag-src')
    rowEls.current.forEach((el) => el?.classList.add('drop-target'))
    drag.current = { book, ghost, srcEl, row: -1, index: -1, valid: false, offX: ev.clientX - r.left, offY: ev.clientY - r.top }
  }

  function moveDrag(ev) {
    const d = drag.current
    if (!d) return
    d.ghost.style.left = ev.clientX - d.offX + 'px'
    d.ghost.style.top = ev.clientY - d.offY + 'px'

    let row = -1
    let bestD = 90
    rowEls.current.forEach((el, r) => {
      if (!el) return
      const rect = el.getBoundingClientRect()
      const dist = ev.clientY < rect.top ? rect.top - ev.clientY : ev.clientY > rect.bottom ? ev.clientY - rect.bottom : 0
      if (dist < bestD) { bestD = dist; row = r }
    })

    caretEls.current.forEach((c) => c?.classList.remove('show', 'bad'))
    rowEls.current.forEach((el) => el?.classList.remove('over', 'bad'))
    if (row < 0 || !shelf) { d.row = -1; return }

    const rowBooks = layout.rows[row] || []
    const els = Array.from(rowEls.current[row]?.querySelectorAll('.spine') || [])
    let index = 0
    for (const el of els) {
      const rect = el.getBoundingClientRect()
      if (ev.clientX > rect.left + rect.width / 2) index++
    }
    index = Math.min(index, rowBooks.length)

    // capacity check in world units
    const innerW = rowInnerW(shelf)
    const others = rowBooks.filter((b) => b.id !== d.book.id)
    let used = 0
    others.forEach((b, i) => (used += thicknessOf(b) + (i > 0 ? 2 : 0)))
    const fits = used + thicknessOf(d.book) + (others.length ? 2 : 0) <= innerW

    d.row = row
    d.index = index
    d.valid = fits
    rowEls.current[row]?.classList.add(fits ? 'over' : 'bad')
    const caret = caretEls.current[row]
    if (caret) {
      const anchor = els[index]
      caret.style.left = (anchor ? anchor.offsetLeft - 1 : (rowEls.current[row]?.scrollWidth || 0)) + 'px'
      caret.style.height = rowEls.current[row]?.clientHeight + 'px'
      caret.classList.add('show')
      if (!fits) caret.classList.add('bad')
    }
  }

  function endDrag() {
    const d = drag.current
    if (!d) return
    d.ghost.remove()
    d.srcEl.classList.remove('drag-src')
    rowEls.current.forEach((el) => el?.classList.remove('drop-target', 'over', 'bad'))
    caretEls.current.forEach((c) => c?.classList.remove('show', 'bad'))
    drag.current = null
    if (!shelf || d.row < 0 || !d.valid) return
    if (shelf.sortMode !== 'custom') toast('Switched to custom order')
    actions.moveBooks([d.book.id], shelf.id, { row: d.row, index: d.index })
  }

  // ── context menus ───────────────────────────────────────────────────────
  function bookMenu(e, book) {
    e.preventDefault()
    e.stopPropagation()
    const selected = selection.size ? [...selection] : [book.id]
    openMenu(
      [
        { icon: '✎', label: 'Details…', onClick: () => actions.openBook(book.id) },
        book.status === 'read'
          ? { icon: '○', label: 'Mark as unread', onClick: () => actions.updateBook(book.id, { status: 'unread' }) }
          : book.status === 'reading'
            ? { icon: '✓', label: 'Mark as read', onClick: () => actions.updateBook(book.id, { status: 'read' }) }
            : { icon: '◐', label: 'Mark as reading', onClick: () => actions.updateBook(book.id, { status: 'reading' }) },
        { icon: '→', label: 'Move to…', onClick: () => setMoving(selected) },
        '-',
        !isLoose && {
          icon: '📦',
          label: 'Remove from shelf',
          onClick: () => {
            actions.moveBooks(selected, null)
            toast('Moved to Loose Books')
          },
        },
        {
          icon: '🗑',
          label: selection.size > 1 ? `Delete ${selected.length} books…` : 'Delete book…',
          danger: true,
          onClick: async () => {
            const ok = await confirm(
              selection.size > 1
                ? `Delete ${selected.length} books permanently?`
                : `Delete “${book.title || book.series}” permanently?`,
              { okLabel: 'Delete', danger: true },
            )
            if (ok) {
              actions.deleteBooks(selected)
              setSelection(new Set())
            }
          },
        },
      ].filter(Boolean),
      e.clientX,
      e.clientY,
    )
  }

  function caseMenu(e) {
    e.preventDefault()
    if (isLoose) {
      openMenu(
        [
          { icon: '＋', label: 'Add a book…', onClick: () => actions.newBook(null) },
          '-',
          { icon: '⚙', label: 'Settings…', onClick: () => actions.openSettings() },
          { icon: '▤', label: 'Back to the room', onClick: () => actions.openRoom() },
        ],
        e.clientX,
        e.clientY,
      )
      return
    }
    openMenu(
      [
        { icon: '＋', label: 'Add a book…', onClick: () => actions.newBook(shelf.id) },
        { icon: '⇩', label: 'Import comics to this shelf…', onClick: () => impRef.current?.click() },
        { icon: '⚙', label: 'Bookcase options…', onClick: () => actions.openShelfSettings(shelf.id) },
        '-',
        { icon: '▤', label: 'Back to the room', onClick: () => actions.openRoom() },
      ],
      e.clientX,
      e.clientY,
    )
  }

  // ── selection (loose view) ──────────────────────────────────────────────
  function toggleSelect(book) {
    setSelection((sel) => {
      const next = new Set(sel)
      if (next.has(book.id)) next.delete(book.id)
      else next.add(book.id)
      return next
    })
  }

  // ── render helpers ──────────────────────────────────────────────────────
  const rowH = Math.round(ROW_H * scale)
  const boardH = Math.round(BOARD * scale)

  const sortMode = isLoose ? looseSort.mode : shelf?.sortMode || 'custom'
  const reverse = isLoose ? looseSort.reverse : shelf?.reverse || false
  const viewMode = isLoose ? looseView : shelf?.viewMode || 'spines'

  function setSort(mode) {
    if (isLoose) setLooseSort((s) => ({ ...s, mode }))
    else actions.setShelfSort(shelf.id, mode, shelf.reverse)
  }
  function setRev(r) {
    if (isLoose) setLooseSort((s) => ({ ...s, reverse: r }))
    else actions.setShelfSort(shelf.id, shelf.sortMode, r)
  }
  function setViewMode(mode) {
    if (isLoose) setLooseView(mode)
    else actions.updateShelf(shelf.id, { viewMode: mode })
  }

  const title = isLoose ? 'Loose books' : shelf?.name || ''

  // shelf vanished (deleted elsewhere) — the effect above redirects home
  if (!isLoose && !shelf) {
    return <div className="shelf-view"><div className="sv-body" /></div>
  }

  return (
    <div className="shelf-view">
      {/* header */}
      <div className="sv-head">
        <button className="btn btn-ghost sv-back" onClick={() => actions.openRoom()}>← Room</button>
        {isLoose ? (
          <h1 className="sv-title">📦 Loose books</h1>
        ) : rename ? (
          <input
            className="sv-rename"
            autoFocus
            defaultValue={shelf.name}
            onBlur={(e) => { actions.updateShelf(shelf.id, { name: e.target.value.trim() || shelf.name }); setRename(false) }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.target.blur()
              if (e.key === 'Escape') { setRename(false); e.preventDefault() }
            }}
          />
        ) : (
          <h1 className="sv-title clickable" onClick={() => setRename(true)} title="Click to rename">
            {title}
          </h1>
        )}
        <span className="sv-stats">
          {stats.total} book{stats.total === 1 ? '' : 's'} · {stats.read} read
        </span>

        <div className="sv-tools">
          <div className="seg">
            <button
              className={'seg-btn' + (viewMode === 'spines' ? ' on' : '')}
              onClick={() => setViewMode('spines')}
              title="Show spines"
            >
              ▮▮ Spines
            </button>
            <button
              className={'seg-btn' + (viewMode === 'covers' ? ' on' : '')}
              onClick={() => setViewMode('covers')}
              title="Show covers"
            >
              ▣ Covers
            </button>
          </div>

          <select
            className="sort-select"
            value={sortMode}
            onChange={(e) => setSort(e.target.value)}
            title="Sort"
          >
            {Object.entries(SORTS).map(([k, v]) => (
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
          <button
            className="icon-btn"
            disabled={sortMode === 'custom'}
            onClick={() => setRev(!reverse)}
            title={reverse ? 'Descending — click for ascending' : 'Ascending — click for descending'}
          >
            {reverse ? '⇩' : '⇧'}
          </button>

          <input
            className="sv-filter"
            placeholder="Filter…"
            value={fq}
            onChange={(e) => setFq(e.target.value)}
          />
          <button className="btn" onClick={() => actions.newBook(isLoose ? null : shelf.id)}>＋ Add book</button>
          <button className="icon-btn" onClick={caseMenu} title="More">⋯</button>
        </div>
      </div>

      {selection.size > 0 && (
        <div className="sel-bar">
          <b>{selection.size}</b> selected
          <select
            defaultValue=""
            onChange={(e) => {
              const v = e.target.value
              if (!v) return
              actions.moveBooks([...selection], v === 'loose' ? null : v)
              toast('Moved ' + selection.size + ' books')
              setSelection(new Set())
              e.target.value = ''
            }}
          >
            <option value="" disabled>Move to…</option>
            {!isLoose && <option value="loose">📦 Loose books</option>}
            {state.shelves.filter((s) => s.id !== shelfId).map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <button
            className="btn btn-danger"
            onClick={async () => {
              const ok = await confirm(`Delete ${selection.size} books permanently?`, { okLabel: 'Delete', danger: true })
              if (ok) { actions.deleteBooks([...selection]); setSelection(new Set()) }
            }}
          >
            Delete
          </button>
          <button className="btn btn-ghost" onClick={() => setSelection(new Set())}>Clear</button>
        </div>
      )}

      {/* body */}
      <div className={'sv-body' + (isLoose ? ' loose' : '')} ref={bodyRef}>
        {isLoose ? (
          books.length === 0 ? (
            <div className="sv-empty">
              <div className="sv-empty-big">📦</div>
              <p>Nothing loose right now.</p>
              <p className="sv-empty-sub">Imported books land here until you shelve them.</p>
            </div>
          ) : viewMode === 'covers' ? (
            <div className="loose-wrap covers">
              {looseOrdered.map((b) => (
                <Cover
                  key={b.id}
                  book={b}
                  dim={!matchesFilter(b)}
                  selected={selection.has(b.id)}
                  checkbox={toggleSelect}
                  onOpen={(bk) => actions.openBook(bk.id)}
                  onMenu={bookMenu}
                />
              ))}
            </div>
          ) : (
            <div className="loose-wrap">
              {looseOrdered.map((b) => (
                <Spine
                  key={b.id}
                  book={b}
                  scale={scale}
                  rowH={190}
                  dim={!matchesFilter(b)}
                  selected={selection.has(b.id)}
                  checkbox={toggleSelect}
                  onMenu={bookMenu}
                  onEnter={showTip}
                  onLeave={hideTip}
                  onDown={(e, book) => { if (e.button === 0) actions.openBook(book.id) }}
                />
              ))}
            </div>
          )
        ) : (
          <div
            className="sv-case"
            style={{
              width: shelf.width * scale,
              '--s': scale,
              '--wood-face': (WOODS[shelf.wood] || WOODS.oak).face,
              '--wood-edge': (WOODS[shelf.wood] || WOODS.oak).edge,
              '--wood-back': (WOODS[shelf.wood] || WOODS.oak).back,
              '--wood-board': (WOODS[shelf.wood] || WOODS.oak).board,
            }}
          >
            <div className="sv-plaque" onContextMenu={caseMenu}>
              <span>{shelf.name}</span>
            </div>
            <div className="sv-frame">
              {viewMode === 'covers' ? (
                <div className="covers-grid">
                  {[...layout.rows.flat(), ...layout.overflow.flat()].map((b) => (
                    <Cover
                      key={b.id}
                      book={b}
                      dim={!matchesFilter(b)}
                      onOpen={(bk) => actions.openBook(bk.id)}
                      onMenu={bookMenu}
                    />
                  ))}
                  {!layout.rows.some((r) => r.length) && (
                    <div className="sv-row-empty">empty shelf</div>
                  )}
                </div>
              ) : (
                layout.rows.map((row, r) => (
                  <React.Fragment key={r}>
                    <div
                      className="sv-row"
                      style={{ height: rowH + 6 }}
                      ref={(el) => (rowEls.current[r] = el)}
                    >
                      {row.map((b) => (
                        <Spine
                          key={b.id}
                          book={b}
                          scale={scale}
                          rowH={rowH}
                          dim={!matchesFilter(b)}
                          onDown={onSpineDown}
                          onMenu={bookMenu}
                          onEnter={showTip}
                          onLeave={hideTip}
                        />
                      ))}
                      {!row.length && <div className="sv-row-empty">empty shelf</div>}
                      <div className="sv-caret" ref={(el) => (caretEls.current[r] = el)} />
                    </div>
                    <div className="sv-board" style={{ height: boardH }} />
                  </React.Fragment>
                ))
              )}
            </div>

            {layout.overflow.length > 0 && (
              <div className="sv-overflow">
                <div className="sv-overflow-note">
                  {layout.overflow.flat().length} book{layout.overflow.flat().length === 1 ? '' : 's'} don’t
                  fit in this bookcase —
                  <button className="btn btn-mini" onClick={() => actions.openShelfSettings(shelf.id)}>make it bigger</button>
                  <button
                    className="btn btn-mini"
                    onClick={() => {
                      const ids = layout.overflow.flat().map((b) => b.id)
                      actions.moveBooks(ids, null)
                      toast('Moved overflow to Loose Books')
                    }}
                  >
                    send to Loose books
                  </button>
                </div>
                <div className="loose-wrap small">
                  {layout.overflow.flat().map((b) => (
                    <Spine
                      key={b.id}
                      book={b}
                      scale={1.6}
                      rowH={130}
                      onMenu={bookMenu}
                      onEnter={showTip}
                      onLeave={hideTip}
                      onDown={(e, book) => { if (e.button === 0) actions.openBook(book.id) }}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {!isLoose && stats.total === 0 && (
          <div className="sv-empty">
            <div className="sv-empty-big">▤</div>
            <p>This bookcase is empty.</p>
            <p className="sv-empty-sub">
              Drop <b>.cbz</b> files anywhere, or <button className="linklike" onClick={() => actions.newBook(shelf.id)}>add a book by hand</button>.
            </p>
          </div>
        )}
      </div>

      {/* tooltip */}
      {tip && <Tooltip tip={tip} />}

      {moving && <MoveDialog ids={moving} onClose={() => setMoving(null)} />}

      <input
        ref={impRef}
        type="file"
        multiple
        accept=".cbz,.zip"
        hidden
        onChange={(e) => {
          if (!isLoose && shelf) actions.importFiles(e.target.files, shelf.id)
          e.target.value = ''
        }}
      />
    </div>
  )
}

function Tooltip({ tip }) {
  const url = useBlobUrl(tip.book.coverId)
  return (
    <div className="book-tip" style={{ left: tip.x, top: tip.y }} onMouseEnter={() => {}}>
      <BookChip book={tip.book} coverUrl={url} />
    </div>
  )
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
}
