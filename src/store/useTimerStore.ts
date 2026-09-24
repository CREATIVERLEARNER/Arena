import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { localStorageAdapter } from "@/lib/storage";
import { minutesToSeconds, todayKey } from "@/lib/time";
import type { FocusLog, TimerMode, TimerStatus } from "@/lib/types";
import { DEEP_WORK_MAX, DEEP_WORK_MIN } from "@/lib/timer-meta";

/**
 * The Focus Timer engine.
 *
 * Preferences (mode, durations, focus log) persist across sessions; live
 * session state (remaining/elapsed, running status) intentionally does not —
 * a refresh lands you back at a calm, idle timer, never mid-countdown confusion.
 *
 * `tick(deltaSeconds)` is called by the engine loop (a React hook added in
 * Phase 3) which derives delta from wall-clock timestamps, so the countdown
 * stays drift-free even when the tab throttles.
 */

const DEFAULT_POMODORO_FOCUS_MINUTES = 25;
const DEFAULT_POMODORO_BREAK_MINUTES = 5;
const DEFAULT_DEEP_WORK_MINUTES = 50;

interface TimerState {
  /* ── preferences (persisted) ─────────────────────────── */
  mode: TimerMode;
  pomodoroFocusMinutes: number;
  pomodoroBreakMinutes: number;
  deepWorkMinutes: number;

  /* ── live session state (ephemeral) ──────────────────── */
  status: TimerStatus;
  isBreak: boolean;
  remainingSeconds: number;
  elapsedSeconds: number;

  /* ── progress (persisted) ────────────────────────────── */
  completedFocusSessions: number;
  focusLog: FocusLog;

  /* ── ui ──────────────────────────────────────────────── */
  zenMode: boolean;

  /* ── actions ─────────────────────────────────────────── */
  setMode: (mode: TimerMode) => void;
  setPomodoroDurations: (focusMinutes: number, breakMinutes: number) => void;
  setDeepWorkMinutes: (minutes: number) => void;
  start: () => void;
  pause: () => void;
  reset: () => void;
  toggleZen: () => void;
  tick: (deltaSeconds: number) => void;
}

/** Full session length (in seconds) for the current mode & break flag. */
const sessionLength = (state: TimerState): number => {
  if (state.mode === "stopwatch") return 0;
  if (state.mode === "deep-work") return minutesToSeconds(state.deepWorkMinutes);
  return state.isBreak
    ? minutesToSeconds(state.pomodoroBreakMinutes)
    : minutesToSeconds(state.pomodoroFocusMinutes);
};

const initialRemaining = (state: TimerState): number => sessionLength(state);

export const useTimerStore = create<TimerState>()(
  persist(
    (set, get) => ({
      mode: "pomodoro",
      pomodoroFocusMinutes: DEFAULT_POMODORO_FOCUS_MINUTES,
      pomodoroBreakMinutes: DEFAULT_POMODORO_BREAK_MINUTES,
      deepWorkMinutes: DEFAULT_DEEP_WORK_MINUTES,

      status: "idle",
      isBreak: false,
      remainingSeconds: DEFAULT_POMODORO_FOCUS_MINUTES * 60,
      elapsedSeconds: 0,

      completedFocusSessions: 0,
      focusLog: {},

      zenMode: false,

      setMode: (mode) => {
        if (get().mode === mode) return;
        set((state) => ({
          mode,
          status: "idle",
          isBreak: false,
          remainingSeconds: initialRemaining({ ...state, mode }),
          elapsedSeconds: 0,
        }));
      },

      setPomodoroDurations: (focusMinutes, breakMinutes) => {
        const clamp = (n: number) => Math.min(180, Math.max(1, Math.round(n)));
        set((state) => ({
          pomodoroFocusMinutes: clamp(focusMinutes),
          pomodoroBreakMinutes: clamp(breakMinutes),
          // re-arm only while idle so we never yank a running session
          ...(state.status === "idle" && !state.isBreak
            ? { remainingSeconds: minutesToSeconds(clamp(focusMinutes)) }
            : {}),
        }));
      },

      setDeepWorkMinutes: (minutes) => {
        const clamped = Math.min(DEEP_WORK_MAX, Math.max(DEEP_WORK_MIN, Math.round(minutes)));
        set((state) => ({
          deepWorkMinutes: clamped,
          ...(state.status === "idle" && state.mode === "deep-work"
            ? { remainingSeconds: minutesToSeconds(clamped) }
            : {}),
        }));
      },

      start: () => {
        const state = get();
        if (state.status === "running") return;
        if (state.status === "idle") {
          // arm a fresh session
          set({
            remainingSeconds: initialRemaining(state),
            elapsedSeconds: 0,
            status: "running",
          });
          return;
        }
        set({ status: "running" }); // resume from paused
      },

      pause: () => {
        if (get().status !== "running") return;
        set({ status: "paused" });
      },

      reset: () => {
        set((state) => ({
          status: "idle",
          isBreak: false,
          remainingSeconds: initialRemaining({ ...state, isBreak: false }),
          elapsedSeconds: 0,
        }));
      },

      toggleZen: () => {
        set((state) => ({ zenMode: !state.zenMode }));
      },

      tick: (deltaSeconds) => {
        const state = get();
        if (state.status !== "running" || deltaSeconds <= 0) return;

        if (state.mode === "stopwatch") {
          set({ elapsedSeconds: state.elapsedSeconds + deltaSeconds });
          return;
        }

        const remaining = Math.max(0, state.remainingSeconds - deltaSeconds);
        if (remaining > 0) {
          set({ remainingSeconds: remaining });
          return;
        }

        /* ── session boundary ── */
        const focusedSeconds = sessionLength(state);
        if (!state.isBreak) {
          const focusDay = todayKey();
          const isPomodoro = state.mode === "pomodoro";
          set({
            completedFocusSessions: state.completedFocusSessions + 1,
            focusLog: {
              ...state.focusLog,
              [focusDay]: (state.focusLog[focusDay] ?? 0) + focusedSeconds,
            },
            isBreak: isPomodoro, // pomodoro flows into a break; deep work rests for good
            remainingSeconds: isPomodoro
              ? minutesToSeconds(state.pomodoroBreakMinutes)
              : 0,
            status: "finished",
          });
        } else {
          set({
            isBreak: false,
            remainingSeconds: minutesToSeconds(state.pomodoroFocusMinutes),
            status: "finished",
          });
        }
      },
    }),
    {
      name: "void:timer",
      version: 1,
      storage: createJSONStorage(() => localStorageAdapter),
      // Persist preferences & progress only — never the live session.
      partialize: (state) => ({
        mode: state.mode,
        pomodoroFocusMinutes: state.pomodoroFocusMinutes,
        pomodoroBreakMinutes: state.pomodoroBreakMinutes,
        deepWorkMinutes: state.deepWorkMinutes,
        completedFocusSessions: state.completedFocusSessions,
        focusLog: state.focusLog,
      }),
    },
  ),
);

/* ── Selectors ─────────────────────────────────────────────── */

export const selectIsTimerActive = (state: TimerState) =>
  state.status === "running";

export const selectTodayFocusSeconds = (state: TimerState) =>
  state.focusLog[todayKey()] ?? 0;

/**
 * Ring progress 0→1. Countdown drains the ring; the stopwatch becomes a
 * seconds dial, refilling every minute.
 */
export const selectTimerProgress = (state: TimerState): number => {
  if (state.mode === "stopwatch") return (state.elapsedSeconds % 60) / 60;
  const total = sessionLength(state);
  if (total <= 0) return 0;
  return Math.min(1, Math.max(0, 1 - state.remainingSeconds / total));
};
