// ── IndexedDB persistence ─────────────────────────────────────────────────
// Two object stores:
//   'state' → a single JSON blob (key 'main') with all shelves, books, settings
//   'blobs' → { id, blob } image blobs (downscaled covers + spine images)
//
// The CBZ files themselves are never stored — only the small cover image and
// metadata extracted at import time, so the database stays lightweight.

const DB_NAME = 'bookroom'
const DB_VERSION = 1

let dbp = null

function db() {
  if (!dbp) {
    dbp = new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION)
      req.onupgradeneeded = () => {
        const d = req.result
        if (!d.objectStoreNames.contains('state')) d.createObjectStore('state')
        if (!d.objectStoreNames.contains('blobs')) d.createObjectStore('blobs', { keyPath: 'id' })
      }
      req.onsuccess = () => resolve(req.result)
      req.onerror = () => reject(req.error)
    })
  }
  return dbp
}

function tx(store, mode, fn) {
  return db().then(
    (d) =>
      new Promise((resolve, reject) => {
        const t = d.transaction(store, mode)
        const req = fn(t.objectStore(store))
        t.oncomplete = () => resolve(req ? req.result : undefined)
        t.onerror = () => reject(t.error)
        t.onabort = () => reject(t.error)
      }),
  )
}

export const loadState = () => tx('state', 'readonly', (s) => s.get('main')).then((v) => v ?? null)
export const saveState = (state) => tx('state', 'readwrite', (s) => s.put(state, 'main'))

export const putBlob = (id, blob) => tx('blobs', 'readwrite', (s) => s.put({ id, blob }))
export const getBlob = (id) => tx('blobs', 'readonly', (s) => s.get(id)).then((r) => (r ? r.blob : null))
export const delBlob = (id) => tx('blobs', 'readwrite', (s) => s.delete(id))
export const allBlobs = () => tx('blobs', 'readonly', (s) => s.getAll())
export const clearBlobs = () => tx('blobs', 'readwrite', (s) => s.clear())

export async function wipeAll() {
  await tx('state', 'readwrite', (s) => s.clear())
  await tx('blobs', 'readwrite', (s) => s.clear())
}

export async function storageEstimate() {
  try {
    const e = await navigator.storage?.estimate?.()
    if (e) return { usage: e.usage || 0, quota: e.quota || 0 }
  } catch { /* ignore */ }
  return null
}

export function fmtBytes(n) {
  if (!n && n !== 0) return '—'
  if (n < 1024) return n + ' B'
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB'
  if (n < 1024 * 1024 * 1024) return (n / 1024 / 1024).toFixed(1) + ' MB'
  return (n / 1024 / 1024 / 1024).toFixed(2) + ' GB'
}
