import React from 'react'
import { useApp } from '../context.js'
import {
  WOODS, layoutShelf, bookcaseHeight, thicknessOf, spineHeightFactor,
  spineColorOf, WALL_H,
} from '../state.js'

/**
 * A bookcase standing on the room's floor, drawn in world units.
 * Spines are little coloured blocks here — the zoomed-in ShelfView renders
 * the detailed spines with text.
 */
export default function Bookcase({ shelf, dim, pulse, onBodyDown, onEdgeDown, onCog, onMenu }) {
  const { state } = useApp()
  const { rows } = layoutShelf(shelf, state.books)
  const wood = WOODS[shelf.wood] || WOODS.oak
  const h = bookcaseHeight(shelf.rows)
  const count = state.books.filter((b) => b.shelfId === shelf.id).length

  return (
    <div
      className={
        'bookcase' + (dim ? ' dim' : '') + (pulse ? ' pulse' : '')
      }
      data-id={shelf.id}
      style={{
        left: shelf.x,
        top: WALL_H - h,
        width: shelf.width,
        height: h,
        '--wood-face': wood.face,
        '--wood-edge': wood.edge,
        '--wood-back': wood.back,
        '--wood-board': wood.board,
      }}
      onPointerDown={(e) => onBodyDown(e, shelf)}
      onContextMenu={(e) => onMenu(e, shelf)}
    >
      <div className="bc-crown" />
      <div className="bc-plaque" title={shelf.name + ' — ' + count + ' books'}>
        <span>{shelf.name}</span>
      </div>
      <div className="bc-frame">
        {rows.map((row, r) => (
          <React.Fragment key={r}>
            <div className="bc-row">
              {row.map((b) => (
                <div
                  key={b.id}
                  className="bc-spine"
                  style={{
                    width: thicknessOf(b),
                    height: Math.round(spineHeightFactor(b) * 100) + '%',
                    background: spineColorOf(b),
                  }}
                >
                  {b.status !== 'read' && b.status !== 'reading' && <i className="bc-dot" />}
                </div>
              ))}
              {!row.length && <div className="bc-row-empty" />}
            </div>
            <div className="bc-board" />
          </React.Fragment>
        ))}
      </div>
      <button
        className="bc-cog"
        title="Bookcase options"
        onPointerDown={(e) => e.stopPropagation()}
        onClick={(e) => onCog(e, shelf)}
      >
        ⋯
      </button>
      <div
        className="bc-edge bc-edge-l"
        title="Drag to resize"
        onPointerDown={(e) => { e.stopPropagation(); onEdgeDown(e, shelf, 'l') }}
      />
      <div
        className="bc-edge bc-edge-r"
        title="Drag to resize"
        onPointerDown={(e) => { e.stopPropagation(); onEdgeDown(e, shelf, 'r') }}
      />
    </div>
  )
}
