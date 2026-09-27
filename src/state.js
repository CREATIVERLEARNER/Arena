// ── Domain model: shelves, books, layout & pure state actions ─────────────
// All coordinates are "world" units. The room is one long wall; bookcases
// stand side by side on the floor and can be dragged anywhere along it.

import { uid, COLL, numOf, clamp, hashStr, spineColorOf, thicknessOf, spineHeightFactor, contrastText } from './lib/util.js'

// Geometry (world px) — shared by the room view and the zoomed-in shelf view.
export const FRAME = 16 // bookcase side wall thickness
export const BOARD = 12 // shelf board thickness
export const TOP = 48 // crown + name plaque zone
export const ROW_H = 86 // one row of books
export const GAP = 2 // gap between spines
export const WALL_H = 560 // wall height above the floor line
export const FLOOR_H = 170 // visible floor band
export const WORLD_H = WALL_H + FLOOR_H
export const MIN_W = 240
export const MAX_W = 1400

export const WOODS = {
  oak: { label: 'Oak', face: '#b0824f', edge: '#8a6238', back: '#7a5533', board: '#9c7043' },
  walnut: { label: 'Walnut', face: '#7d5533', edge: '#5c3d24', back: '#4f3420', board: '#6d4829' },
  cherry: { label: 'Cherry', face: '#93483a', edge: '#6e3226', back: '#5e2c22', board: '#7e3c2f' },
  ebony: { label: 'Ebony', face: '#3c322b', edge: '#28211c', back: '#221c17', board: '#332a24' },
  sage: { label: 'Painted sage', face: '#7f8a72', edge: '#5f6a55', back: '#545e4a', board: '#6f7a63' },
  cream: { label: 'Painted cream', face: '#e3d7bd', edge: '#b3a480', back: '#a4957a', board: '#d6c8ab' },
}

export const STATUS_ORDER = { unread: 0, reading: 1, read: 2 }

// 12px top border + 48px plaque zone + rows + 18px base border
export function bookcaseHeight(rows) {
  return TOP + rows * (ROW_H + BOARD) + 30
}

// ── sorting ───────────────────────────────────────────────────────────────

const cmpTitle = (a, b) => COLL.compare(a.title || '', b.title || '')
const cmpSeries = (a, b) =>
  COLL.compare(a.series || '', b.series || '') ||
  (numOf(a.number) ?? 1e9) - (numOf(b.number) ?? 1e9) ||
  cmpTitle(a, b)

export const SORTS = {
  custom: { label: 'Custom — drag to arrange' },
  title: { label: 'Title A → Z', cmp: cmpTitle },
  series: { label: 'Series & volume', cmp: cmpSeries },
  author: {
    label: 'Author / artist',
    cmp: (a, b) =>
      COLL.compare(a.author || '\uffff', b.author || '\uffff') || cmpSeries(a, b),
  },
  rating: {
    label: 'Favourites first',
    cmp: (a, b) => (b.rating || 0) - (a.rating || 0) || cmpSeries(a, b),
  },
  added: { label: 'Recently added', cmp: (a, b) => (b.addedAt || 0) - (a.addedAt || 0) },
  status: {
    label: 'Read status',
    cmp: (a, b) =>
      (STATUS_ORDER[a.status] ?? 0) - (STATUS_ORDER[b.status] ?? 0) || cmpSeries(a, b),
  },
}

// ── layout: which books sit on which row ──────────────────────────────────

/** Inner usable width of one row, in world px. */
export const rowInnerW = (shelf) => shelf.width - FRAME * 2 - 6

const fitsIn = (used, count, innerW, t) => used + t + (count > 0 ? GAP : 0) <= innerW

/**
 * Compute the visible arrangement of a shelf's books.
 * Custom mode → books sit at their stored row/order.
 * Sorted mode → the whole bookcase is ordered by the active sort, then flowed
 * row by row respecting capacity.
 *
 * @returns {{ rows: Array<Array<book>>, overflow: Array<Array<book>> }}
 *   `rows` always has exactly `shelf.rows` entries; anything that doesn't fit
 *   lands in `overflow` (rendered in a tray below the bookcase).
 */
export function layoutShelf(shelf, books) {
  const innerW = rowInnerW(shelf)
  const rows = Array.from({ length: shelf.rows }, () => [])
  const overflow = []
  const mine = books.filter((b) => b.shelfId === shelf.id)

  if (!shelf.sortMode || shelf.sortMode === 'custom') {
    const byRow = new Map()
    for (const b of mine) {
      const r = clamp(Number.isInteger(b.row) ? b.row : 0, 0, 1e9)
      if (!byRow.has(r)) byRow.set(r, [])
      byRow.get(r).push(b)
    }
    for (const [r, list] of [...byRow.entries()].sort((a, b) => a[0] - b[0])) {
      list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      if (r < shelf.rows) {
        let used = 0
        for (const b of list) {
          const t = thicknessOf(b)
          if (fitsIn(used, rows[r].length, innerW, t)) {
            rows[r].push(b)
            used += t + (rows[r].length > 1 ? GAP : 0)
          } else {
            // shelf got narrower — book no longer fits on its row
            const last = overflow[overflow.length - 1]
            if (last) last.push(b)
            else overflow.push([b])
          }
        }
      } else {
        // row beyond the case (rows were removed but books were kept)
        const last = overflow[overflow.length - 1]
        if (last) last.push(...list)
        else overflow.push(list)
      }
    }
  } else {
    const cmp = SORTS[shelf.sortMode].cmp
    const list = [...mine].sort(cmp)
    if (shelf.reverse) list.reverse()
    let ri = 0
    let used = 0
    for (const b of list) {
      const t = thicknessOf(b)
      if (ri < shelf.rows && !fitsIn(used, rows[ri].length, innerW, t)) {
        ri++
        used = 0
      }
      if (ri < shelf.rows) {
        rows[ri].push(b)
        used += t + (rows[ri].length > 1 ? GAP : 0)
      } else {
        const last = overflow[overflow.length - 1]
        if (!last || last.length >= 40) overflow.push([b])
        else last.push(b)
      }
    }
  }
  return { rows, overflow: overflow.filter((r) => r && r.length) }
}

/**
 * Bake the currently-displayed arrangement into row/order values and switch
 * the shelf to custom mode. Used when the user drags a book on a sorted shelf.
 */
export function materializeLayout(state, shelf) {
  if (!shelf || (!shelf.sortMode || shelf.sortMode === 'custom')) return state
  const { rows, overflow } = layoutShelf(shelf, state.books)
  const order = new Map()
  rows.forEach((row, r) => row.forEach((b, i) => order.set(b.id, { row: r, order: i })))
  overflow.forEach((row, r) => row.forEach((b, i) => order.set(b.id, { row: shelf.rows + r, order: i })))
  return {
    ...state,
    shelves: state.shelves.map((s) => (s.id === shelf.id ? { ...s, sortMode: 'custom' } : s)),
    books: state.books.map((b) => (order.has(b.id) ? { ...b, ...order.get(b.id) } : b)),
  }
}

/** First row (and end index) with room for a book of thickness t. */
export function findSpot(shelf, books, t) {
  const { rows } = layoutShelf(shelf, books)
  const innerW = rowInnerW(shelf)
  for (let r = 0; r < rows.length; r++) {
    let used = 0
    rows[r].forEach((b, i) => (used += thicknessOf(b) + (i > 0 ? GAP : 0)))
    if (fitsIn(used, rows[r].length, innerW, t)) return { row: r, index: rows[r].length, fits: true }
  }
  return { row: Math.max(0, shelf.rows - 1), index: rows[shelf.rows - 1]?.length ?? 0, fits: false }
}

// ── pure actions ──────────────────────────────────────────────────────────

export function defaultState() {
  return { version: 1, shelves: [], books: [], settings: { view: null } }
}

export function addShelf(state, patch = {}) {
  const n = state.shelves.length + 1
  const width = patch.width ?? 620
  // find the first gap on the wall wide enough, else append at the end
  const sorted = [...state.shelves].sort((a, b) => a.x - b.x)
  let x = 80
  for (const s of sorted) {
    if (s.x - x >= width + 60) break
    x = Math.max(x, s.x + s.width + 60)
  }
  const shelf = {
    id: patch.id || uid('sh-'),
    name: patch.name || 'Bookcase ' + n,
    x: patch.x ?? x,
    width,
    rows: patch.rows ?? 4,
    wood: patch.wood || 'oak',
    sortMode: patch.sortMode || 'custom',
    reverse: false,
    viewMode: patch.viewMode || 'spines',
    createdAt: Date.now(),
  }
  return { ...state, shelves: [...state.shelves, shelf] }
}

export function updateShelf(state, id, patch) {
  let next = {
    ...state,
    shelves: state.shelves.map((s) => (s.id === id ? { ...s, ...patch } : s)),
  }
  // clamp books back onto the case if rows were removed
  const shelf = next.shelves.find((s) => s.id === id)
  if (patch.rows !== undefined && shelf) {
    next = {
      ...next,
      books: next.books.map((b) =>
        b.shelfId === id && Number.isInteger(b.row) && b.row >= shelf.rows
          ? { ...b, row: shelf.rows - 1 }
          : b,
      ),
    }
  }
  return next
}

export function deleteShelf(state, id, alsoDeleteBooks = false) {
  const affected = state.books.filter((b) => b.shelfId === id)
  let looseOrder = Math.max(0, ...state.books.filter((b) => !b.shelfId).map((b) => b.order ?? 0))
  return {
    ...state,
    shelves: state.shelves.filter((s) => s.id !== id),
    books: alsoDeleteBooks
      ? state.books.filter((b) => b.shelfId !== id)
      : state.books.map((b) => {
          if (b.shelfId !== id) return b
          looseOrder += 1
          return { ...b, shelfId: null, row: 0, order: looseOrder }
        }),
  }
}

export function updateBook(state, id, patch) {
  return { ...state, books: state.books.map((b) => (b.id === id ? { ...b, ...patch } : b)) }
}

export function addBooks(state, newBooks) {
  let looseOrder = Math.max(0, ...state.books.filter((b) => !b.shelfId).map((b) => b.order ?? 0))
  const withOrder = newBooks.map((b) => {
    looseOrder += 1
    return { ...b, shelfId: b.shelfId ?? null, row: 0, order: looseOrder, status: b.status || 'unread', rating: b.rating || 0, tags: b.tags || [] }
  })
  return { ...state, books: [...state.books, ...withOrder] }
}

/** Books whose blobs should be deleted when these books go away. */
export function blobIdsOf(books) {
  const ids = []
  for (const b of books) {
    if (b.coverId) ids.push(b.coverId)
    if (b.spineImageId) ids.push(b.spineImageId)
  }
  return ids
}

export function deleteBooks(state, ids) {
  const set = new Set(ids)
  return { ...state, books: state.books.filter((b) => !set.has(b.id)) }
}

/**
 * Move books to a shelf (or to Loose Books when shelfId is null).
 * In custom mode an exact {row, index} can be given; otherwise the first row
 * with room is used. `state` should already be materialized when dropping
 * into a custom shelf mid-drag.
 */
export function moveBooks(state, ids, shelfId, spot = null) {
  const idSet = new Set(ids)
  const shelf = shelfId ? state.shelves.find((s) => s.id === shelfId) : null

  // Books already on this shelf (minus the moved ones), per row, in custom order.
  // This is the evolving model the batch is placed into, so capacity is
  // respected across every book in the batch.
  const rowsMap = new Map()
  if (shelf) {
    for (const b of state.books) {
      if (b.shelfId !== shelfId || idSet.has(b.id)) continue
      const r = clamp(Number.isInteger(b.row) ? b.row : 0, 0, shelf.rows - 1)
      if (!rowsMap.has(r)) rowsMap.set(r, [])
      rowsMap.get(r).push(b)
    }
    for (const list of rowsMap.values()) list.sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
  }

  const orderMap = new Map() // bookId → patch {row, order, shelfId?}
  let looseOrder = Math.max(
    0,
    ...state.books.filter((b) => !b.shelfId && !idSet.has(b.id)).map((b) => b.order ?? 0),
    0,
  )

  const moved = state.books.filter((b) => idSet.has(b.id))
  let first = true
  for (const b of moved) {
    if (!shelf) {
      looseOrder += 1
      orderMap.set(b.id, { shelfId: null, row: 0, order: looseOrder })
      continue
    }
    let row = spot && first ? spot.row : undefined
    let index = spot && first ? spot.index : undefined
    first = false
    if (row === undefined || index === undefined) {
      // first row with room for this book
      const innerW = rowInnerW(shelf)
      outer: for (let r = 0; r < shelf.rows; r++) {
        const list = rowsMap.get(r) || []
        let used = 0
        list.forEach((x, i) => (used += thicknessOf(x) + (i > 0 ? GAP : 0)))
        if (fitsIn(used, list.length, innerW, thicknessOf(b))) {
          row = r
          index = list.length
          break outer
        }
      }
      if (row === undefined) {
        row = shelf.rows - 1
        index = (rowsMap.get(row) || []).length
      }
    }
    row = clamp(row, 0, shelf.rows - 1)
    const list = rowsMap.get(row) || []
    index = clamp(index, 0, list.length)
    list.splice(index, 0, b)
    rowsMap.set(row, list)
    list.forEach((x, i) =>
      orderMap.set(
        x.id,
        x.id === b.id || idSet.has(x.id)
          ? { shelfId, row, order: i } // books in this batch land on the shelf
          : { row, order: i }, // neighbours just get resequenced
      ),
    )
  }

  return {
    ...state,
    books: state.books.map((b) => {
      const o = orderMap.get(b.id)
      return o ? { ...b, ...o } : b
    }),
  }
}

// ── misc selectors ────────────────────────────────────────────────────────

export const booksOfShelf = (state, shelfId) =>
  state.books.filter((b) => b.shelfId === shelfId)

export const looseBooks = (state) => state.books.filter((b) => !b.shelfId)

export function shelfStats(state, shelfId) {
  const list = state.books.filter((b) => b.shelfId === shelfId)
  return { total: list.length, read: list.filter((b) => b.status === 'read').length }
}

export function bookLabel(b) {
  const series = b.series || b.title
  return b.number !== null && b.number !== undefined && b.number !== ''
    ? `${series} · ${b.number}`
    : series
}

export { spineColorOf, thicknessOf, hashStr, spineHeightFactor, contrastText }
