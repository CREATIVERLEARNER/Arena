// ── Small shared UI primitives ────────────────────────────────────────────
// Modal, context menu, toasts, stars, generated cover art, blob-url hook.

import React, { useEffect, useRef, useState } from 'react'
import { getBlob } from '../lib/db.js'
import { contrastText, shade, spineColorOf } from '../lib/util.js'
import { bookLabel } from '../state.js'

// ── blob URLs ─────────────────────────────────────────────────────────────

const urlCache = new Map() // blobId → objectURL

/** Resolve a stored blob id to an object URL (cached for the app's lifetime). */
export function useBlobUrl(blobId) {
  const [url, setUrl] = useState(() => (blobId ? urlCache.get(blobId) || null : null))
  useEffect(() => {
    if (!blobId) { setUrl(null); return }
    const cached = urlCache.get(blobId)
    if (cached) { setUrl(cached); return }
    let alive = true
    getBlob(blobId).then((blob) => {
      if (!alive || !blob) return
      const u = URL.createObjectURL(blob)
      urlCache.set(blobId, u)
      setUrl(u)
    }).catch(() => {})
    return () => { alive = false }
  }, [blobId])
  return url
}

// ── modal shell ───────────────────────────────────────────────────────────

export function Modal({ title, onClose, children, wide, footer }) {
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose?.() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])
  return (
    <div className="overlay" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose?.() }}>
      <div className={'modal' + (wide ? ' modal-wide' : '')} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>{title}</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>
  )
}

// ── context menu (singleton, managed by App) ──────────────────────────────

export function ContextMenu({ menu, onClose }) {
  const ref = useRef(null)
  const [pos, setPos] = useState({ left: menu.x, top: menu.y })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    setPos({
      left: Math.min(menu.x, window.innerWidth - r.width - 10),
      top: Math.min(menu.y, window.innerHeight - r.height - 10),
    })
  }, [menu])

  useEffect(() => {
    const close = () => onClose()
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('mousedown', close)
    window.addEventListener('contextmenu', close)
    window.addEventListener('keydown', onKey)
    window.addEventListener('blur', close)
    return () => {
      window.removeEventListener('mousedown', close)
      window.removeEventListener('contextmenu', close)
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('blur', close)
    }
  }, [onClose])

  return (
    <div
      ref={ref}
      className="ctx-menu"
      style={pos}
      onMouseDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      {menu.items.map((it, i) =>
        it === '-' ? (
          <div key={i} className="ctx-sep" />
        ) : (
          <button
            key={i}
            className={'ctx-item' + (it.danger ? ' danger' : '')}
            onClick={() => { onClose(); it.onClick?.() }}
            disabled={it.disabled}
          >
            {it.icon && <span className="ctx-icon">{it.icon}</span>}
            {it.label}
          </button>
        ),
      )}
    </div>
  )
}

// ── toasts ────────────────────────────────────────────────────────────────

export function Toasts({ toasts }) {
  return (
    <div className="toasts">
      {toasts.map((t) => (
        <div key={t.id} className="toast">
          <span>{t.msg}</span>
          {t.action && (
            <button className="toast-action" onClick={t.action.fn}>
              {t.action.label}
            </button>
          )}
        </div>
      ))}
    </div>
  )
}

// ── stars ─────────────────────────────────────────────────────────────────

export function Stars({ value, onChange, size = 'm' }) {
  return (
    <span className={'stars' + (size === 's' ? ' stars-s' : '')}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          className={'star' + (n <= (value || 0) ? ' on' : '')}
          onClick={onChange ? () => onChange(value === n ? 0 : n) : undefined}
          tabIndex={onChange ? 0 : -1}
          aria-label={n + ' of 5'}
        >
          ★
        </button>
      ))}
    </span>
  )
}

// ── generated cover art (used when a book has no cover image) ─────────────

export function CoverArt({ book, coverUrl, className, style, showText = true }) {
  const col = spineColorOf(book)
  const text = contrastText(col)
  if (coverUrl) {
    return <img className={className} style={style} src={coverUrl} alt="" draggable={false} />
  }
  return (
    <div
      className={(className || '') + ' cover-gen'}
      style={{ ...style, ['--c']: col, ['--c2']: shade(col, 0, 6, 12), ['--c3']: shade(col, 0, -6, -14), color: text }}
    >
      {showText && (
        <>
          <div className="cover-gen-frame" />
          <div className="cover-gen-series">{book.series || book.title}</div>
          {book.author && <div className="cover-gen-author">{book.author}</div>}
          {book.number != null && book.number !== '' && <div className="cover-gen-vol">{book.number}</div>}
        </>
      )}
    </div>
  )
}

// ── tiny book chip for tooltips / pickers ─────────────────────────────────

export function BookChip({ book, coverUrl }) {
  return (
    <div className="book-chip">
      <CoverArt book={book} coverUrl={coverUrl} className="chip-cover" />
      <div className="chip-meta">
        <div className="chip-title">{book.title || book.series}</div>
        <div className="chip-sub">{bookLabel(book)}</div>
        {book.author && <div className="chip-sub">{book.author}</div>}
        <div className="chip-row">
          <Stars value={book.rating} size="s" />
          <span className={'chip-status st-' + (book.status || 'unread')}>
            {(book.status || 'unread')}
          </span>
        </div>
      </div>
    </div>
  )
}
