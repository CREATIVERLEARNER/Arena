/**
 * Shared domain types for Void.
 * Keep this file pure — no runtime code, no imports.
 */

/* ── Timer ─────────────────────────────────────────────── */

export type TimerMode = "pomodoro" | "deep-work" | "stopwatch";

export type TimerStatus = "idle" | "running" | "paused" | "finished";

/* ── Tasks ─────────────────────────────────────────────── */

export interface Task {
  id: string;
  title: string;
  completed: boolean;
  createdAt: number;
  /** Timestamp of completion — null while the task is still among the living. */
  completedAt: number | null;
}

/* ── Analytics ─────────────────────────────────────────── */

/** Day key ("YYYY-MM-DD", local time) → focused seconds that day. */
export type FocusLog = Record<string, number>;
