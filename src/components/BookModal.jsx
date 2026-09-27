import React, { useMemo, useRef, useState } from 'react'
import { useApp } from '../context.js'
import { Modal, Stars, CoverArt, useBlobUrl } from './ui.jsx'
import { SPINE_PALETTE, spineColorOf, uid, fmtDate } from '../lib/util.js'
import { moveBooks as moveBooksPure, addBooks, findSpot, thicknessOf } from '../state.js'

const STATUS = [
  ['unread', 'Unread'],
  ['reading', 'Reading'],
  ['read', 'Read'],
]

export default function BookModal({ mode, bookId, targetShelfId, onClose }) {
  const { state, setState, actions, confirm, toast } = useApp()
  const isNew = mode === 'new'
  const book = isNew ? null : state.books.find((b) => b.id === bookId)

  const [draft, setDraft] = useState(() => ({
    title: '', series: '', number: '', author: '', pages: '',
    status: 'unread', rating: 0, tags: '', notes: '', spineColor: null,
  }))
  // where the new book goes — starts as whatever view opened the form
  const [target, setTarget] = useState(targetShelfId ?? null)
  // tags are edited as a raw string, committed as an array on blur/enter
  const [tagsDraft, setTagsDraft] = useState(null)
  const [pendingCover, setPendingCover] = useState(null) // {blob, url} before creation
  const coverInput = useRef(null)
  const spineInput = useRef(null)

  const shelfOptions = useMemo(
    () => [{ id: null, name: '📦 Loose books' }, ...state.shelves.map((s) => ({ id: s.id, name: s.name }))],
    [state.shelves],
  )

  if (!isNew && !book) {
    return (
      <Modal title="Book" onClose={onClose}>
        <p className="muted">This book no longer exists.</p>
      </Modal>
    )
  }

  const b = isNew ? draft : book
  const set = (patch) => {
    if (isNew) setDraft((d) => ({ ...d, ...patch }))
    else actions.updateBook(book.id, patch)
  }

  const coverUrl = useBlobUrl(isNew ? null : book.coverId)
  const shownCover = isNew ? pendingCover?.url : coverUrl

  const coverFile = isNew
    ? async (file) => {
        const url = URL.createObjectURL(file)
        setPendingCover((p) => { if (p) URL.revokeObjectURL(p.url); return { blob: file, url } })
      }
    : async (file) => actions.replaceCover(book, file, 'cover')

  const spineFile = isNew
    ? async () => toast('Add the book first, then upload a spine image')
    : async (file) => actions.replaceCover(book, file, 'spine')

  async function saveNew() {
    const id = uid('bk-')
    let coverId = null
    if (pendingCover) {
      coverId = uid('cov-')
      const { shrinkImage } = await import('../lib/importer.js')
      const shrunk = await shrinkImage(pendingCover.blob, 640)
      const { putBlob } = await import('../lib/db.js')
      await putBlob(coverId, shrunk).catch(() => { coverId = null })
      URL.revokeObjectURL(pendingCover.url)
    }
    const meta = {
      id,
      title: draft.title.trim() || draft.series.trim() || 'Untitled',
      series: draft.series.trim(),
      number: draft.number === '' ? null : draft.number,
      author: draft.author.trim(),
      pages: draft.pages ? parseInt(draft.pages, 10) || null : null,
      status: draft.status,
      rating: draft.rating,
      tags: draft.tags.split(',').map((t) => t.trim()).filter(Boolean),
      notes: draft.notes,
      spineColor: draft.spineColor,
      coverId,
      spineImageId: null,
      addedAt: Date.now(),
    }
    // does it fit on the chosen shelf? if not, it goes to Loose Books
    const shelfObj = target ? state.shelves.find((s) => s.id === target) : null
    const fits = shelfObj ? findSpot(shelfObj, state.books, thicknessOf(meta)).fits : false
    const dest = fits ? target : null
    setState((s) => moveBooksPure(addBooks(s, [meta]), [id], dest))
    toast(
      dest
        ? `Book added to “${shelfObj.name}”`
        : shelfObj
          ? 'Bookcase is full — added to Loose Books'
          : 'Book added to Loose Books',
    )
    onClose()
  }

  return (
    <Modal title={isNew ? 'Add a book' : (b.title || b.series || 'Book')} onClose={onClose} wide>
      <div className="bm">
        {/* left — cover */}
        <div className="bm-left">
          <div className="bm-cover-box">
            <CoverArt book={isNew ? { ...draft, title: draft.title || 'Untitled', series: draft.series || draft.title } : book} coverUrl={shownCover} className="bm-cover" />
          </div>
          <div className="bm-cover-btns">
            <button className="btn btn-mini" onClick={() => coverInput.current?.click()}>
              {shownCover ? 'Change cover…' : 'Upload cover…'}
            </button>
            {shownCover && !isNew && (
              <button className="btn btn-mini btn-ghost" onClick={() => actions.clearImage(book, 'cover')}>Remove</button>
            )}
          </div>
          {!isNew && (
            <div className="bm-spineimg">
              <button className="btn btn-mini" onClick={() => spineInput.current?.click()}>
                {book.spineImageId ? 'Change spine image…' : 'Custom spine image…'}
              </button>
              {book.spineImageId && (
                <button className="btn btn-mini btn-ghost" onClick={() => actions.clearImage(book, 'spine')}>Remove</button>
              )}
              <p className="hint">Optional — an image used for this book’s spine. Without one, a spine is generated from the title.</p>
            </div>
          )}
          {!isNew && (
            <div className="bm-meta-line">
              {book.pages ? book.pages + ' pages · ' : ''}
              added {fmtDate(book.addedAt)}
            </div>
          )}
          <input ref={coverInput} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) coverFile(f)
            e.target.value = ''
          }} />
          <input ref={spineInput} type="file" accept="image/*" hidden onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) spineFile(f)
            e.target.value = ''
          }} />
        </div>

        {/* right — fields */}
        <div className="bm-right">
          <label className="field">
            <span>Title</span>
            <input value={b.title || ''} onChange={(e) => set({ title: e.target.value })} placeholder="Neon Samurai Vol. 3" />
          </label>
          <div className="field-row">
            <label className="field">
              <span>Series</span>
              <input value={b.series || ''} onChange={(e) => set({ series: e.target.value })} placeholder="Neon Samurai" />
            </label>
            <label className="field field-narrow">
              <span>Volume</span>
              <input value={b.number ?? ''} onChange={(e) => set({ number: e.target.value })} placeholder="3" />
            </label>
          </div>
          <div className="field-row">
            <label className="field">
              <span>Author / artist</span>
              <input value={b.author || ''} onChange={(e) => set({ author: e.target.value })} placeholder="K. Ishikawa" />
            </label>
            <label className="field field-narrow">
              <span>Pages</span>
              <input
                value={isNew ? draft.pages : b.pages ?? ''}
                onChange={(e) =>
                  set({
                    pages: isNew
                      ? e.target.value
                      : e.target.value.trim() === ''
                        ? null
                        : parseInt(e.target.value, 10) || null,
                  })
                }
                placeholder="—"
                inputMode="numeric"
              />
            </label>
          </div>

          <div className="field-row">
            <div className="field">
              <span>Status</span>
              <div className="seg">
                {STATUS.map(([k, label]) => (
                  <button
                    key={k}
                    className={'seg-btn' + (b.status === k ? ' on' : '')}
                    onClick={() => set({ status: k })}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <span>Rating</span>
              <Stars value={b.rating} onChange={(n) => set({ rating: n })} />
            </div>
          </div>

          <div className="field">
            <span>Spine colour</span>
            <div className="swatches">
              <button
                className={'swatch auto' + (!b.spineColor ? ' on' : '')}
                onClick={() => set({ spineColor: null })}
                title="Auto — from series name"
              >
                A
              </button>
              {SPINE_PALETTE.map((c) => (
                <button
                  key={c}
                  className={'swatch' + (b.spineColor === c ? ' on' : '')}
                  style={{ background: c }}
                  onClick={() => set({ spineColor: c })}
                  title={c}
                />
              ))}
              <label className="swatch custom" title="Custom colour">
                <input
                  type="color"
                  value={b.spineColor || spineColorOf(isNew ? draft : book)}
                  onChange={(e) => set({ spineColor: e.target.value })}
                />
              </label>
            </div>
          </div>

          <label className="field">
            <span>Tags <em>(comma separated)</em></span>
            <input
              value={isNew ? draft.tags : tagsDraft ?? (b.tags || []).join(', ')}
              onChange={(e) => (isNew ? set({ tags: e.target.value }) : setTagsDraft(e.target.value))}
              onBlur={() => {
                if (!isNew && tagsDraft !== null) {
                  set({ tags: tagsDraft.split(',').map((t) => t.trim()).filter(Boolean) })
                  setTagsDraft(null)
                }
              }}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') e.target.blur() }}
              placeholder="manga, sci-fi, owned"
            />
          </label>

          <label className="field">
            <span>Notes</span>
            <textarea
              rows={2}
              value={isNew ? draft.notes : b.notes || ''}
              onChange={(e) => set({ notes: e.target.value })}
              placeholder="Borrowed by Sam · missing vol 4 …"
            />
          </label>

          {!isNew && (
            <label className="field">
              <span>Lives on</span>
              <select
                value={book.shelfId || ''}
                onChange={(e) => {
                  const target = e.target.value || null
                  actions.moveBooks([book.id], target)
                  toast(target ? 'Moved' : 'Moved to Loose Books')
                }}
              >
                {shelfOptions.map((o) => (
                  <option key={o.id ?? 'loose'} value={o.id ?? ''}>{o.name}</option>
                ))}
              </select>
            </label>
          )}

          <div className="bm-actions">
            {isNew ? (
              <>
                <label className="field bm-addto">
                  <span>Add to</span>
                  <select value={target ?? ''} onChange={(e) => setTarget(e.target.value || null)}>
                    {shelfOptions.map((o) => (
                      <option key={o.id ?? 'loose'} value={o.id ?? ''}>{o.name}</option>
                    ))}
                  </select>
                </label>
                <span className="spacer" />
                <button className="btn" onClick={onClose}>Cancel</button>
                <button className="btn btn-primary" onClick={saveNew}>Add book</button>
              </>
            ) : (
              <>
                <button
                  className="btn btn-danger"
                  onClick={async () => {
                    const ok = await confirm(`Delete “${book.title || book.series}” permanently?`, { okLabel: 'Delete', danger: true })
                    if (ok) { actions.deleteBooks([book.id]); onClose() }
                  }}
                >
                  Delete
                </button>
                <span className="spacer" />
                <button className="btn btn-primary" onClick={onClose}>Done</button>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  )
}
