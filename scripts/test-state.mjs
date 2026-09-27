// Domain-logic tests for state.js — layout, capacity, moves, sorts, overflow.
// These are pure functions, so they run under plain Node.

import assert from 'node:assert'
import {
  defaultState, addShelf, addBooks, updateShelf, deleteShelf, updateBook,
  moveBooks, materializeLayout, layoutShelf, rowInnerW, findSpot, thicknessOf,
  SORTS, bookcaseHeight, TOP, ROW_H, BOARD,
} from '../src/state.js'

const B = (id, series, number, extra = {}) => ({
  id, title: series + (number ?? ''), series, number: number ?? null,
  author: '', rating: 0, status: 'unread', tags: [], spineColor: null,
  coverId: null, spineImageId: null, pages: 160, notes: '', addedAt: +id.replace(/\D/g, '') || 1,
  ...extra,
})

// ── shelf placement ──
let s = defaultState()
s = addShelf(s, { id: 's1', name: 'A', x: 100, width: 620, rows: 3 })
s = addShelf(s, { name: 'B' }) // auto-placed after A with a 60px gap
assert.equal(s.shelves.length, 2)
assert.equal(s.shelves[1].x, 100 + 620 + 60, 'auto-placement appends after the last case')

// ── geometry ──
assert.equal(bookcaseHeight(3), TOP + 3 * (ROW_H + BOARD) + 30, 'case height formula')
assert.equal(rowInnerW(s.shelves[0]), 620 - 32 - 6, 'inner width')

// ── add books to loose, then move onto the shelf ──
s = addBooks(s, [
  B('b1', 'Neon Samurai', 1), B('b2', 'Neon Samurai', 2), B('b3', 'Glass Gardens', 1),
  B('b4', 'Wanderer', 1, { pages: 900 }), B('b5', 'Wanderer', 2),
])
assert.equal(s.books.length, 5)
assert.ok(s.books.every((b) => !b.shelfId), 'new books start loose')

s = moveBooks(s, ['b1', 'b2', 'b3', 'b4', 'b5'], 's1')
{
  const { rows, overflow } = layoutShelf(s.shelves[0], s.books)
  const total = rows.flat().length
  assert.equal(total, 5, 'all five books on the shelf')
  assert.equal(overflow.length, 0, 'no overflow — 620px fits five spines easily')
  // all on row 0 in custom mode, ordered b1..b5
  assert.deepEqual(rows[0].map((b) => b.id), ['b1', 'b2', 'b3', 'b4', 'b5'])
  assert.equal(rows[1].length, 0)
}

// ── capacity: shrink the shelf until books overflow ──
{
  const filler = []
  for (let i = 0; i < 25; i++) filler.push(B('f' + i, 'Filler', i + 1, { pages: 300 }))
  s = addBooks(s, filler)
  s = moveBooks(s, filler.map((f) => f.id), 's1')
  s = updateShelf(s, 's1', { width: 240, rows: 1 }) // 30 books, one narrow row
  const { rows, overflow } = layoutShelf(s.shelves[0], s.books)
  assert.ok(rows[0].length < 30, 'narrow case holds fewer books')
  assert.equal(rows.flat().length + overflow.flat().length, 30, 'overflow keeps the rest')
  s = updateShelf(s, 's1', { width: 1400, rows: 3 }) // restore roominess
  s = moveBooks(s, filler.map((f) => f.id), null) // tidy up for the next test
}

// ── drag reorder within a row (custom mode) ──
s = updateShelf(s, 's1', { width: 1400, rows: 3 })
{
  const { rows } = layoutShelf(s.shelves[0], s.books)
  assert.equal(rows[0].length, 5)
}
s = moveBooks(s, ['b5'], 's1', { row: 0, index: 0 })
{
  const { rows } = layoutShelf(s.shelves[0], s.books)
  assert.deepEqual(rows[0].map((b) => b.id), ['b5', 'b1', 'b2', 'b3', 'b4'], 'drag to front renumbers the row')
  assert.deepEqual(rows[0].map((b) => b.order), [0, 1, 2, 3, 4], 'orders are resequenced 0..n')
}

// ── drag onto row 1 mid-shelf ──
s = moveBooks(s, ['b3'], 's1', { row: 1, index: 0 })
{
  const { rows } = layoutShelf(s.shelves[0], s.books)
  assert.deepEqual(rows[0].map((b) => b.id), ['b5', 'b1', 'b2', 'b4'])
  assert.deepEqual(rows[1].map((b) => b.id), ['b3'])
}

// ── sorted mode reflows across rows ──
s = updateShelf(s, 's1', { sortMode: 'series', width: 240, rows: 2 })
{
  const { rows, overflow } = layoutShelf(s.shelves[0], s.books)
  const ids = [...rows.flat(), ...overflow.flat()].map((b) => b.id)
  // Glass Gardens 1 < Neon Samurai 1 < 2 < Wanderer 1 (900 pages, thick) < 2
  assert.deepEqual(ids.sort(), ['b1', 'b2', 'b3', 'b4', 'b5'])
  assert.equal(rows[0][0].id, 'b3', 'series sort puts Glass Gardens first')
  assert.ok(rows[0].length >= rows[1].length, 'books flow onto row 0 first')
  assert.equal(rows.flat().length + overflow.flat().length, 5)
}

// ── materialize bakes the sorted arrangement, then reorder applies on top ──
{
  const before = layoutShelf(s.shelves[0], s.books)
  s = materializeLayout(s, s.shelves[0])
  assert.equal(s.shelves[0].sortMode, 'custom', 'materialize switches to custom')
  const after = layoutShelf(s.shelves[0], s.books)
  assert.deepEqual(
    before.rows.map((r) => r.map((b) => b.id)),
    after.rows.map((r) => r.map((b) => b.id)),
    'arrangement is preserved when switching to custom',
  )
}

// ── sorting comparators ──
{
  const cmp = SORTS.series.cmp
  const a = B('a', 'Series', 2)
  const b = B('b', 'Series', 10)
  const c = B('c', 'Series', 10.5)
  const d = B('d', 'Another', 1)
  assert.ok(cmp(d, a) < 0, 'series name order')
  assert.ok(cmp(a, b) < 0, 'numeric volume order 2 < 10')
  assert.ok(cmp(b, c) < 0, 'decimal volumes 10 < 10.5')
  assert.ok(SORTS.rating.cmp(B('x', 'X', 1, { rating: 5 }), B('y', 'Y', 1)) < 0, 'favourites first')
  const noNum = B('n', 'Series', null)
  assert.ok(cmp(noNum, a) > 0, 'books without volume sort after numbered ones')
}

// ── status / rating / title sorts don't crash on missing fields ──
for (const key of ['title', 'author', 'rating', 'added', 'status']) {
  const list = [{ id: 'q' }, { id: 'w' }, B('e', 'S', 1)]
  list.sort(SORTS[key].cmp) // must not throw
}

// ── remove a row: books clamp back onto the case ──
s = updateShelf(s, 's1', { rows: 1 })
assert.ok(s.books.filter((b) => b.shelfId === 's1').every((b) => b.row <= 0), 'rows clamp on shrink')

// ── updateBook / deleteShelf ──
s = updateBook(s, 'b1', { status: 'read', rating: 5 })
assert.equal(s.books.find((b) => b.id === 'b1').rating, 5)
const looseBefore = s.books.filter((b) => !b.shelfId).length
s = deleteShelf(s, 's1')
assert.equal(s.shelves.length, 1)
assert.equal(s.books.filter((b) => !b.shelfId).length, looseBefore + 5, 'deleting a case shelves books loose')

// ── findSpot returns a valid row ──
{
  const sh = { id: 'sx', width: 620, rows: 2, sortMode: 'custom' }
  const books = []
  for (let i = 0; i < 40; i++) books.push(B('z' + i, 'Filler', i + 1, { pages: 400 }))
  const { row } = findSpot(sh, books, thicknessOf(books[0]))
  assert.ok(row >= 0 && row < 2, 'findSpot returns a real row')
}

console.log('✓ state.js: layout, capacity, moves, sorts, overflow all pass')
