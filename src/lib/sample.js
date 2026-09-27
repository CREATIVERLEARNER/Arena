// ── Sample library — lets people try the room before importing anything ────

import { uid } from './util.js'
import { addShelf, addBooks } from '../state.js'

const S = (series, number, author, opts = {}) => ({
  title: series + (number != null ? ' Vol. ' + number : ''),
  series,
  number: number ?? null,
  author,
  rating: opts.rating ?? 0,
  status: opts.status || 'unread',
  pages: opts.pages ?? 160 + ((number || 1) * 37) % 200,
  tags: opts.tags || [],
  spineColor: opts.color || null,
  notes: '',
})

export function withSampleLibrary(state) {
  let next = state
  const pos = [{ x: 100 }, { x: 860 }, { x: 1560 }, { x: 2140 }]

  next = addShelf(next, { name: 'Manga', x: pos[0].x, width: 640, rows: 4, wood: 'walnut', sortMode: 'series' })
  next = addShelf(next, { name: 'Western comics', x: pos[1].x, width: 640, rows: 3, wood: 'oak', sortMode: 'custom' })
  next = addShelf(next, { name: 'To read next', x: pos[2].x, width: 460, rows: 2, wood: 'sage', sortMode: 'custom' })
  next = addShelf(next, { name: 'Favourites', x: pos[3].x, width: 400, rows: 2, wood: 'cherry', sortMode: 'rating' })

  const shelves = next.shelves
  const idOf = (name) => shelves.find((s) => s.name === name).id
  let books = []
  const B = (shelfName, meta) => books.push({ ...S(meta.series, meta.number, meta.author, meta), id: uid('bk-'), shelfId: idOf(shelfName), addedAt: Date.now() - books.length * 86400000 })

  for (let i = 1; i <= 12; i++) B('Manga', { series: 'Neon Samurai', number: i, author: 'K. Ishikawa', rating: i <= 4 ? 5 : 4, status: i <= 9 ? 'read' : 'reading', color: '#9d3b31' })
  for (let i = 1; i <= 7; i++) B('Manga', { series: 'Wanderer’s Road', number: i, author: 'M. Tanabe', rating: 4, status: 'read', color: '#417a7e' })
  for (let i = 1; i <= 5; i++) B('Manga', { series: 'Glass Gardens', number: i, author: 'A. Mori', rating: 5, status: i <= 2 ? 'read' : 'unread', color: '#6d8a56' })
  B('Manga', { series: 'Hollow Planet', number: 1, author: 'R. Sato', rating: 3, status: 'reading', color: '#56609c' })
  for (let i = 1; i <= 6; i++) B('Manga', { series: 'Iron Cranes', number: i, author: 'K. Ishikawa', rating: 3, status: 'read', color: '#8a5588' })

  B('Western comics', { series: 'The Long Winter', number: 1, author: 'J. Hale', rating: 5, status: 'read', color: '#46709b' })
  for (let i = 1; i <= 4; i++) B('Western comics', { series: 'Copperopolis', number: i, author: 'D. Reyes', rating: 4, status: i <= 2 ? 'read' : 'unread', color: '#c07b3b' })
  B('Western comics', { series: 'Stars & Mud', number: 1, author: 'P. Byrne', rating: 4, status: 'unread' })
  B('Western comics', { series: 'Stars & Mud', number: 2, author: 'P. Byrne', rating: 4, status: 'unread' })
  B('Western comics', { series: 'The Boxroom Heist', number: 1, author: 'L. Ostrowski', rating: 5, status: 'read', color: '#7c5b4a' })

  B('To read next', { series: 'Neon Samurai', number: 13, author: 'K. Ishikawa', rating: 0, color: '#9d3b31' })
  B('To read next', { series: 'Glass Gardens', number: 6, author: 'A. Mori', color: '#6d8a56' })
  B('To read next', { series: 'Salt Meridian', number: 1, author: 'N. Farid', color: '#b3924a' })
  B('To read next', { series: 'Salt Meridian', number: 2, author: 'N. Farid', color: '#b3924a' })
  B('To read next', { series: 'Vault of Hours', number: 1, author: 'E. Lindqvist', color: '#6f5a99' })

  for (let i = 1; i <= 3; i++) B('Favourites', { series: 'Wanderer’s Road', number: i, author: 'M. Tanabe', rating: 5, status: 'read', color: '#417a7e' })
  B('Favourites', { series: 'The Long Winter', number: 1, author: 'J. Hale', rating: 5, status: 'read', color: '#46709b' })
  B('Favourites', { series: 'The Boxroom Heist', number: 1, author: 'L. Ostrowski', rating: 5, status: 'read', color: '#7c5b4a' })
  B('Favourites', { series: 'Glass Gardens', number: 3, author: 'A. Mori', rating: 5, status: 'read', color: '#6d8a56' })

  next = addBooks(next, books)
  // give the custom-mode shelves a sensible spread across their rows
  const shelfById = new Map(next.shelves.map((s) => [s.id, s]))
  const counters = new Map()
  next = {
    ...next,
    books: next.books.map((b) => {
      if (!b.shelfId) return b
      const shelf = shelfById.get(b.shelfId)
      if (shelf.sortMode !== 'custom') return { ...b, row: 0, order: 0 }
      const i = counters.get(b.shelfId) || 0
      counters.set(b.shelfId, i + 1)
      const perRow = Math.max(1, Math.ceil(30 / shelf.rows))
      return { ...b, row: Math.floor(i / perRow) % shelf.rows, order: i }
    }),
  }
  return next
}
