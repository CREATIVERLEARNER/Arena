import React, { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { useApp } from '../context.js'
import Bookcase from './Bookcase.jsx'
import { WALL_H, WORLD_H, MIN_W, MAX_W, shelfStats, looseBooks } from '../state.js'
import { clamp } from '../lib/util.js'

const Z_MIN = 0.14
const Z_MAX = 3

/**
 * The room: one long wall with bookcases standing on the floor.
 * Pan by dragging the background, zoom with the wheel, move a bookcase by
 * dragging it, open it with a click, right-click anything for options.
 */
export default function RoomView() {
  const { state, actions, openMenu, confirm, toast } = useApp()
  const wrapRef = useRef(null)
  const fileRef = useRef(null)
  const searchRef = useRef(null)
  const [view, setView] = useState(() => state.settings.view || null)
  const [q, setQ] = useState('')
  const [pulseId, setPulseId] = useState(null)
  const viewRef = useRef(view)
  viewRef.current = view
  const saveTimer = useRef(null)

  const worldW = useMemo(
    () => Math.max(1800, ...state.shelves.map((s) => s.x + s.width), 0) + 700,
    [state.shelves],
  )
  const looseCount = looseBooks(state).length

  // ── view maths ──────────────────────────────────────────────────────────
  function clampView(v) {
    const el = wrapRef.current
    if (!el) return v
    const w = el.clientWidth
    const h = el.clientHeight
    const xMin = Math.min(w - worldW * v.z - 200, 160)
    const xMax = Math.max(160, w - worldW * v.z - 200)
    const yMin = Math.min(h - WORLD_H * v.z - 60, 40)
    const yMax = Math.max(40, h - WORLD_H * v.z - 60)
    return { z: v.z, x: clamp(v.x, xMin, xMax), y: clamp(v.y, yMin, yMax) }
  }

  function fitView() {
    const el = wrapRef.current
    if (!el) return { x: 0, y: 0, z: 0.8 }
    if (!state.shelves.length) {
      const z = 0.8
      return clampView({ x: 120, y: el.clientHeight - WORLD_H * z - 40, z })
    }
    const minX = Math.min(...state.shelves.map((s) => s.x))
    const maxX = Math.max(...state.shelves.map((s) => s.x + s.width))
    const z = clamp(Math.min((el.clientWidth - 160) / (maxX - minX + 80), (el.clientHeight - 140) / WORLD_H), Z_MIN, 1.4)
    return clampView({
      z,
      x: (el.clientWidth - (maxX - minX) * z) / 2 - minX * z,
      y: (el.clientHeight - WORLD_H * z) / 2,
    })
  }

  // initial view: restored (clamped to the current window), or fitted to the shelves
  useLayoutEffect(() => {
    if (view) { setView(clampView(view)); return }
    setView(fitView())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function setViewClamped(v) {
    setView(clampView(v))
  }

  function scheduleSaveView() {
    clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => viewRef.current && actions.saveView(viewRef.current), 900)
  }

  function zoomBy(f) {
    const v = viewRef.current || { x: 0, y: 0, z: 0.8 }
    const el = wrapRef.current
    const mx = el.clientWidth / 2
    const my = el.clientHeight / 2
    const z = clamp(v.z * f, Z_MIN, Z_MAX)
    setViewClamped({ z, x: mx - (mx - v.x) * (z / v.z), y: my - (my - v.y) * (z / v.z) })
    scheduleSaveView()
  }

  function centerOn(shelf) {
    const el = wrapRef.current
    const v = viewRef.current
    setViewClamped({ ...v, x: el.clientWidth / 2 - (shelf.x + shelf.width / 2) * v.z })
    setPulseId(shelf.id)
    setTimeout(() => setPulseId(null), 1800)
  }

  // ── wheel zoom ──────────────────────────────────────────────────────────
  useEffect(() => {
    const el = wrapRef.current
    const onWheel = (e) => {
      e.preventDefault()
      const v = viewRef.current || { x: 0, y: 0, z: 0.8 }
      if (e.shiftKey || Math.abs(e.deltaX) > Math.abs(e.deltaY)) {
        setViewClamped({ ...v, x: v.x - (e.deltaX || e.deltaY) })
      } else {
        // plain wheel and trackpad pinch (ctrl+wheel) both zoom
        const f = Math.exp(-e.deltaY * 0.0014)
        const z = clamp(v.z * f, Z_MIN, Z_MAX)
        const rect = el.getBoundingClientRect()
        const mx = e.clientX - rect.left
        const my = e.clientY - rect.top
        setViewClamped({ z, x: mx - (mx - v.x) * (z / v.z), y: my - (my - v.y) * (z / v.z) })
      }
      scheduleSaveView()
    }
    el.addEventListener('wheel', onWheel, { passive: false })
    return () => el.removeEventListener('wheel', onWheel)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [worldW])

  // ── bookcase drag / open ────────────────────────────────────────────────
  function onBodyDown(e, shelf) {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget
    const startX = e.clientX
    const x0 = shelf.x
    let moved = false
    el.classList.add('lifted')
    const onMove = (ev) => {
      if (!moved && Math.abs(ev.clientX - startX) > 4) {
        moved = true
        el.classList.add('dragging')
      }
      if (!moved) return
      el.style.left = Math.max(-100, x0 + (ev.clientX - startX) / viewRef.current.z) + 'px'
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      el.classList.remove('lifted', 'dragging')
      if (!moved) {
        actions.openShelf(shelf.id)
        return
      }
      let x = parseFloat(el.style.left)
      if (!Number.isFinite(x)) x = x0
      // magnet onto neighbouring cases
      for (const o of state.shelves) {
        if (o.id === shelf.id) continue
        if (Math.abs(x - (o.x + o.width + 12)) < 16) x = o.x + o.width + 12
        if (Math.abs(x + shelf.width + 12 - o.x) < 16) x = o.x - shelf.width - 12
      }
      x = Math.round(Math.max(-100, x) / 10) * 10
      if (x !== x0) actions.updateShelf(shelf.id, { x })
      else el.style.left = x0 + 'px'
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  function onEdgeDown(e, shelf, side) {
    if (e.button !== 0) return
    e.preventDefault()
    const el = e.currentTarget.closest('.bookcase')
    const startX = e.clientX
    const x0 = shelf.x
    const w0 = shelf.width
    const onMove = (ev) => {
      const d = (ev.clientX - startX) / viewRef.current.z
      if (side === 'r') {
        el.style.width = clamp(w0 + d, MIN_W, MAX_W) + 'px'
      } else {
        const w = clamp(w0 - d, MIN_W, MAX_W)
        el.style.width = w + 'px'
        el.style.left = x0 + (w0 - w) + 'px'
      }
    }
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      const w = Math.round(clamp(parseFloat(el.style.width) || w0, MIN_W, MAX_W) / 20) * 20
      let x = shelf.x
      if (side === 'l') x = Math.round((x0 + (w0 - w)) / 10) * 10
      actions.updateShelf(shelf.id, { width: w, x })
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  // ── background pan + pinch ──────────────────────────────────────────────
  const pointers = useRef(new Map())
  const pan = useRef(null)
  const pinch = useRef(null)

  function onBgDown(e) {
    if (e.button === 2) return
    // don't pan when the press starts on the HUD or empty-state card
    if (e.target.closest('.hud-top, .hud-zoom, .empty-card, .ctx-menu, button, input, select, textarea, a')) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 1 && viewRef.current) {
      pan.current = { x: e.clientX, y: e.clientY, vx: viewRef.current.x, vy: viewRef.current.y, moved: false }
    } else if (pointers.current.size === 2) {
      pan.current = null
      const [a, b] = [...pointers.current.values()]
      pinch.current = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        z: viewRef.current.z,
        midX: (a.x + b.x) / 2,
        midY: (a.y + b.y) / 2,
        vx: viewRef.current.x,
        vy: viewRef.current.y,
      }
    }
    try { wrapRef.current.setPointerCapture(e.pointerId) } catch { /* pointer already gone */ }
  }

  function onBgMove(e) {
    if (pointers.current.has(e.pointerId)) {
      pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    }
    if (pinch.current && pointers.current.size >= 2) {
      const [a, b] = [...pointers.current.values()]
      const dist = Math.hypot(a.x - b.x, a.y - b.y)
      const p = pinch.current
      const z = clamp((p.z * dist) / Math.max(20, p.dist), Z_MIN, Z_MAX)
      const el = wrapRef.current
      const rect = el.getBoundingClientRect()
      const mx = p.midX - rect.left
      const my = p.midY - rect.top
      setViewClamped({ z, x: mx - (mx - p.vx) * (z / p.z), y: my - (my - p.vy) * (z / p.z) })
    } else if (pan.current) {
      const p = pan.current
      const dx = e.clientX - p.x
      const dy = e.clientY - p.y
      if (!p.moved && Math.hypot(dx, dy) > 3) p.moved = true
      if (p.moved) setViewClamped({ ...viewRef.current, x: p.vx + dx, y: p.vy + dy })
    }
  }

  function onBgUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) {
      if (pan.current?.moved) scheduleSaveView()
      pan.current = null
    }
  }

  // ── menus ───────────────────────────────────────────────────────────────
  function shelfMenu(e, shelf) {
    e.preventDefault()
    e.stopPropagation()
    const stats = shelfStats(state, shelf.id)
    openMenu(
      [
        { icon: '▤', label: `Open “${shelf.name}”`, onClick: () => actions.openShelf(shelf.id) },
        { icon: '＋', label: 'Add a book…', onClick: () => actions.newBook(shelf.id) },
        { icon: '⚙', label: 'Bookcase options…', onClick: () => actions.openShelfSettings(shelf.id) },
        '-',
        {
          icon: '✕',
          label: `Delete bookcase (${stats.total} books → Loose)…`,
          danger: true,
          onClick: async () => {
            const ok = await confirm(
              `Delete “${shelf.name}”? Its ${stats.total} books will move to Loose Books.`,
              { okLabel: 'Delete', danger: true },
            )
            if (ok) {
              actions.deleteShelf(shelf.id, false)
              toast('Bookcase deleted — books are in Loose Books')
            }
          },
        },
      ],
      e.clientX,
      e.clientY,
    )
  }

  function bgMenu(e) {
    e.preventDefault()
    const rect = wrapRef.current.getBoundingClientRect()
    const wx = Math.round(((e.clientX - rect.left - (viewRef.current?.x || 0)) / (viewRef.current?.z || 1)) / 10) * 10
    openMenu(
      [
        { icon: '＋', label: 'Add bookcase here', onClick: () => actions.createShelf({ x: wx }) },
        { icon: '＋', label: 'Add bookcase', onClick: () => actions.createShelf() },
        '-',
        { icon: '⇩', label: 'Import comics (.cbz)…', onClick: () => fileRef.current?.click() },
        { icon: '⤢', label: 'Fit everything in view', onClick: () => setView(fitView()) },
        '-',
        { icon: '⚙', label: 'Settings…', onClick: () => actions.openSettings() },
      ],
      e.clientX,
      e.clientY,
    )
  }

  // ── search ──────────────────────────────────────────────────────────────
  const matches = useMemo(() => {
    const qq = q.trim().toLowerCase()
    if (!qq) return null
    const ids = new Set()
    for (const s of state.shelves) {
      if (s.name.toLowerCase().includes(qq)) { ids.add(s.id); continue }
      const hit = state.books.some(
        (b) =>
          b.shelfId === s.id &&
          `${b.title || ''} ${b.series || ''} ${b.author || ''} ${(b.tags || []).join(' ')}`.toLowerCase().includes(qq),
      )
      if (hit) ids.add(s.id)
    }
    return ids
  }, [q, state])

  function onSearchKey(e) {
    if (e.key === 'Enter' && matches?.size) {
      const first = state.shelves.find((s) => matches.has(s.id))
      if (first) centerOn(first)
    }
    if (e.key === 'Escape') {
      setQ('')
      e.target.blur()
    }
  }

  // ── keyboard shortcuts ──────────────────────────────────────────────────
  useEffect(() => {
    const onKey = (e) => {
      const tag = document.activeElement?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return
      if (e.key === '/') { e.preventDefault(); searchRef.current?.focus() }
      else if (e.key === '0') setView(fitView())
      else if (e.key === '=' || e.key === '+') zoomBy(1.25)
      else if (e.key === '-') zoomBy(0.8)
      else if (e.key === 'n' || e.key === 'N') actions.createShelf()
      else if (e.key === 'Escape') setQ('')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.shelves, matches])

  const v = view || { x: 0, y: 0, z: 0.8 }

  return (
    <div
      className="room"
      ref={wrapRef}
      onPointerDown={onBgDown}
      onPointerMove={onBgMove}
      onPointerUp={onBgUp}
      onPointerCancel={onBgUp}
      onContextMenu={bgMenu}
    >
      <div className="world" style={{ width: worldW, height: WORLD_H, transform: `translate(${v.x}px, ${v.y}px) scale(${v.z})` }}>
        <div className="wall" />
        <div className="wainscot" />
        <div className="floor" />
        {state.shelves.map((s) => (
          <Bookcase
            key={s.id}
            shelf={s}
            dim={!!matches && !matches.has(s.id)}
            pulse={pulseId === s.id}
            onBodyDown={onBodyDown}
            onEdgeDown={onEdgeDown}
            onCog={shelfMenu}
            onMenu={shelfMenu}
          />
        ))}
      </div>

      {!state.shelves.length && (
        <div className="empty-state">
          <div className="empty-card">
            <div className="empty-title">Your Bookroom</div>
            <p>
              Put down bookcases, drop in your <b>.cbz</b> comics, and arrange everything exactly how
              you like it — by hand, by series, by favourite.
            </p>
            <div className="empty-actions">
              <button className="btn btn-primary" onClick={() => actions.createShelf()}>
                ＋ Add a bookcase
              </button>
              <button className="btn" onClick={() => fileRef.current?.click()}>
                ⇩ Import comics
              </button>
              <button className="btn btn-ghost" onClick={actions.loadSample}>
                Load a sample library
              </button>
            </div>
            <div className="empty-hint">
              drag empty space to pan · scroll to zoom · right-click for options
            </div>
          </div>
        </div>
      )}

      <div className="hud-top">
        <div className="hud-glass">
          <div className="brand">
            <span className="brand-glyph">▤</span> Bookroom
          </div>
          <div className="search">
            <input
              ref={searchRef}
              placeholder="Search shelves & books…  ( / )"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              onKeyDown={onSearchKey}
            />
            {matches && (
              <span className="search-count">{matches.size || 'no'} match{matches.size === 1 ? '' : 'es'}</span>
            )}
          </div>
        </div>
        <div className="hud-glass hud-actions">
          <button className="btn btn-primary" onClick={() => actions.createShelf()}>＋ Bookcase</button>
          <button className="btn" onClick={() => fileRef.current?.click()}>⇩ Import CBZ</button>
          <button className="btn" onClick={actions.openLoose} title="Books not on any shelf">
            Loose books {looseCount > 0 && <span className="badge">{looseCount}</span>}
          </button>
          <button className="icon-btn" title="Settings" onClick={() => actions.openSettings()}>⚙</button>
          <button className="icon-btn" title="Help  ( ? )" onClick={() => actions.openHelp()}>?</button>
        </div>
      </div>

      <div className="hud-zoom">
        <button className="icon-btn" onClick={() => zoomBy(0.8)} title="Zoom out  ( − )">−</button>
        <span className="zoom-pct">{Math.round(v.z * 100)}%</span>
        <button className="icon-btn" onClick={() => zoomBy(1.25)} title="Zoom in  ( + )">＋</button>
        <button className="btn btn-mini" onClick={() => setView(fitView())} title="Fit view  ( 0 )">Fit</button>
      </div>

      <input
        ref={fileRef}
        type="file"
        multiple
        accept=".cbz,.zip"
        hidden
        onChange={(e) => {
          actions.importFiles(e.target.files)
          e.target.value = ''
        }}
      />
    </div>
  )
}
