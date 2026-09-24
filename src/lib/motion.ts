/**
 * Shared Framer Motion vocabulary — one easing curve so the whole app
 * breathes at the same tempo. Nothing snaps.
 */

export type VoidEase = [number, number, number, number];

/** The Void curve — fast start, long serene settle. */
export const EASE_VOID: VoidEase = [0.16, 1, 0.3, 1];

export const enterRise = {
  initial: { opacity: 0, y: 12 },
  animate: { opacity: 1, y: 0 },
};

/** Collapse-in for expandable panels (height 0 → auto). */
export const panelMotion = {
  initial: { height: 0, opacity: 0 },
  animate: { height: "auto", opacity: 1 },
  exit: { height: 0, opacity: 0 },
} as const;

export const panelTransition = { duration: 0.7, ease: EASE_VOID };
