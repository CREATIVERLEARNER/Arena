"use client";

import { formatClock, formatDuration } from "@/lib/time";
import { TIMER_MODES } from "@/lib/timer-meta";
import { cn } from "@/lib/utils";
import {
  selectTodayFocusSeconds,
  useTimerStore,
} from "@/store/useTimerStore";

/**
 * The heart of the sanctuary — mode pills and the big mono clock.
 * The countdown engine, progress ring and Zen Mode complete this in Phase 3;
 * everything shown here is already live store state.
 */
export function TimerSection() {
  const mode = useTimerStore((s) => s.mode);
  const setMode = useTimerStore((s) => s.setMode);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const elapsedSeconds = useTimerStore((s) => s.elapsedSeconds);
  const completedSessions = useTimerStore((s) => s.completedFocusSessions);
  const todayFocusSeconds = useTimerStore(selectTodayFocusSeconds);

  const displaySeconds = mode === "stopwatch" ? elapsedSeconds : remainingSeconds;

  return (
    <section aria-label="Focus timer" className="py-14 text-center sm:py-20">
      {/* mode pills */}
      <div
        role="tablist"
        aria-label="Timer mode"
        className="flex items-center justify-center gap-2"
      >
        {TIMER_MODES.map((meta) => {
          const active = mode === meta.id;
          return (
            <button
              key={meta.id}
              role="tab"
              aria-selected={active}
              type="button"
              onClick={() => setMode(meta.id)}
              className={cn(
                "rounded-full border px-4 py-1.5 font-mono text-[10px] tracking-[0.25em] uppercase transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
                active
                  ? "border-glow/40 bg-glow/5 text-silver shadow-[0_0_24px_rgba(139,124,246,0.08)]"
                  : "border-line text-faint hover:border-ghost hover:text-mist",
              )}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      {/* the clock — monospaced digits, zero layout shift */}
      <p className="mt-10 font-mono text-[5.5rem] leading-none font-extralight tracking-[-0.02em] text-silver tabular-nums select-none sm:text-[7rem]">
        {formatClock(displaySeconds)}
      </p>

      <p className="mt-7 font-mono text-[10px] tracking-[0.3em] text-faint uppercase">
        {completedSessions} {completedSessions === 1 ? "session" : "sessions"} ·{" "}
        {formatDuration(todayFocusSeconds)} focused today
      </p>
    </section>
  );
}
