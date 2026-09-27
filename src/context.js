import { createContext, useContext } from 'react'

/**
 * The whole app talks through this single context:
 *   state        — { shelves, books, settings }
 *   view         — { kind: 'room' } | { kind: 'shelf', id } | { kind: 'loose' }
 *   actions      — all mutations (see App.jsx for the list)
 *   toast / confirm / openMenu / openBook — UI utilities
 */
export const AppCtx = createContext(null)
export const useApp = () => useContext(AppCtx)
