// Wiring checks — the render smoke tests can't execute click handlers, and a
// couple of critical paths (like "Add book") live entirely in event handlers.
// This pins the key wirings by asserting they exist in the source.
// Cheap insurance against failed/phantom edits and accidental deletions.

import { readFileSync } from 'node:fs'
import assert from 'node:assert'

const read = (f) => readFileSync(new URL('../src/' + f, import.meta.url), 'utf8')

const checks = [
  ['components/BookModal.jsx', 'setState((s) => moveBooksPure(addBooks(s, [meta]), [id], dest))', 'Add-book commits to state'],
  ['components/BookModal.jsx', 'value={target ?? \'\'}', 'Add-book shelf picker bound'],
  ['components/BookModal.jsx', "import { moveBooks as moveBooksPure, addBooks, findSpot, thicknessOf } from '../state.js'", 'Add-book imports exist'],
  ['App.jsx', 'const viewRef = useRef(view)', 'App tracks the current view for context-aware import'],
  ['App.jsx', 'importToShelf(s, newBooks, targetShelf ? target : null)', 'import places books onto shelves'],
  ['App.jsx', 'onShelve={(shelfId)', 'import panel shelve action wired'],
  ['App.jsx', "setState((s) => importToShelf(s, newBooks, targetShelf ? target : null))", 'importFiles commits via functional setState'],
  ['components/ShelfView.jsx', 'actions.importFiles(e.target.files, shelf.id)', 'shelf import input wired'],
  ['components/ShelfView.jsx', 'actions.moveBooks([d.book.id], shelf.id, { row: d.row, index: d.index })', 'drag reorder commits'],
  ['components/RoomView.jsx', 'actions.openShelf(shelf.id)', 'clicking a bookcase opens it'],
  ['components/RoomView.jsx', 'actions.updateShelf(shelf.id, { x })', 'bookcase drag commits position'],
  ['components/Dialogs.jsx', 'onShelve(v)', 'import overlay offers move-all'],
]

for (const [file, needle, what] of checks) {
  const src = read(file)
  assert.ok(src.includes(needle), `${file}: missing wiring for "${what}"`)
  console.log('✓', what)
}

// patterns that must never appear anywhere
const banned = [
  [/actions\.setState/, 'actions.setState does not exist on the actions object'],
  [/\.setState\?\./, 'optional-chained setState silently does nothing'],
]
for (const f of ['App.jsx', 'components/BookModal.jsx', 'components/ShelfView.jsx', 'components/RoomView.jsx', 'components/Bookcase.jsx', 'components/Dialogs.jsx', 'components/ui.jsx']) {
  const src = read(f)
  for (const [re, why] of banned) {
    assert.ok(!re.test(src), `${f}: ${why}`)
  }
}
console.log('✓ no dead setState calls')

console.log('✓ wiring: all critical paths present')
