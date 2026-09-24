"use client";

import { Minus, Plus } from "lucide-react";

import { TimerControls } from "@/components/timer/TimerControls";
import { TimerCore } from "@/components/timer/TimerCore";
import { TIMER_MODES } from "@/lib/timer-meta";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/useTimerStore";

/** Deep Work bounds for the stepper. */
const STEP = 5;

/**
 * The heart of the sanctuary — mode pills, the ring, and the controls.
 */
export function TimerSection() {
  const mode = useTimerStore((s) => s.mode);
  const setMode = useTimerStore((s) => s.setMode);
  const status = useTimerStore((s) => s.status);
  const deepWorkMinutes = useTimerStore((s) => s.deepWorkMinutes);
  const setDeepWorkMinutes = useTimerStore((s) => s.setDeepWorkMinutes);

  const showStepper = mode === "deep-work" && status === "idle";

  return (
    <section aria-label="Focus timer" className="flex flex-col items-center py-12 sm:py-16">
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

      {/* deep work duration stepper */}
      {showStepper && (
        <div className="mt-5 flex items-center gap-4 font-mono text-[11px] text-faint">
          <button
            type="button"
            onClick={() => setDeepWorkMinutes(deepWorkMinutes - STEP)}
            aria-label="Decrease deep work duration"
            className="grid size-6 place-items-center rounded-full border border-line text-ghost transition-colors duration-500 hover:border-ghost hover:text-mist"
          >
            <Minus className="size-3" aria-hidden />
          </button>
          <span className="w-16 text-center tracking-[0.2em] tabular-nums">
            {deepWorkMinutes} min
          </span>
          <button
            type="button"
            onClick={() => setDeepWorkMinutes(deepWorkMinutes + STEP)}
            aria-label="Increase deep work duration"
            className="grid size-6 place-items-center rounded-full border border-line text-ghost transition-colors duration-500 hover:border-ghost hover:text-mist"
          >
            <Plus className="size-3" aria-hidden />
          </button>
        </div>
      )}

      <div className="mt-10">
        <TimerCore />
      </div>

      <div className="mt-10">
        <TimerControls />
      </div>
    </section>
  );
}
