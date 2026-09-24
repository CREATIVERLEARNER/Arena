/**
 * Timer mode metadata — single source of truth for labels and defaults.
 * UI selects over this; the store keeps the values.
 */

import type { TimerMode } from "@/lib/types";

export interface TimerModeMeta {
  id: TimerMode;
  label: string;
  hint: string;
}

export const TIMER_MODES: readonly TimerModeMeta[] = [
  { id: "pomodoro", label: "Pomodoro", hint: "25 / 5" },
  { id: "deep-work", label: "Deep Work", hint: "unbroken" },
  { id: "stopwatch", label: "Stopwatch", hint: "count up" },
] as const;

export const timerModeMeta = (mode: TimerMode): TimerModeMeta =>
  TIMER_MODES.find((m) => m.id === mode) ?? TIMER_MODES[0];

/** Sensible bounds so Deep Work can't be set to 0 or to a week. */
export const DEEP_WORK_MIN = 5;
export const DEEP_WORK_MAX = 240;
