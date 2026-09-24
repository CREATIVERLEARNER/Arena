"use client";

import { Maximize2, RotateCcw } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/useTimerStore";

interface TimerControlsProps {
  compact?: boolean;
}

/**
 * Begin / pause / reset / zen — the only controls the sanctuary needs.
 */
export function TimerControls({ compact = false }: TimerControlsProps) {
  const status = useTimerStore((s) => s.status);
  const isBreak = useTimerStore((s) => s.isBreak);
  const start = useTimerStore((s) => s.start);
  const pause = useTimerStore((s) => s.pause);
  const reset = useTimerStore((s) => s.reset);
  const toggleZen = useTimerStore((s) => s.toggleZen);

  const running = status === "running";
  const label = running
    ? "pause"
    : status === "paused"
      ? "resume"
      : status === "finished"
        ? isBreak
          ? "begin focus"
          : "begin break"
        : "begin";

  return (
    <div className={cn("flex items-center", compact ? "gap-2.5" : "gap-3")}>
      <button
        type="button"
        onClick={reset}
        aria-label="Reset timer"
        className="grid size-9 place-items-center rounded-full border border-line text-ghost transition-all duration-500 hover:border-ghost hover:text-mist"
      >
        <RotateCcw className="size-3.5" aria-hidden />
      </button>

      <button
        type="button"
        onClick={running ? pause : start}
        className={cn(
          "rounded-full border font-mono text-[11px] uppercase tracking-[0.3em] transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          compact ? "px-6 py-2" : "px-8 py-2.5",
          running
            ? "border-glow/50 bg-glow/10 text-silver shadow-[0_0_24px_rgba(139,124,246,0.15)]"
            : "border-line text-mist hover:border-ghost hover:text-silver",
        )}
      >
        {label}
      </button>

      <button
        type="button"
        onClick={toggleZen}
        aria-label="Toggle Zen Mode"
        className="grid size-9 place-items-center rounded-full border border-line text-ghost transition-all duration-500 hover:border-ghost hover:text-mist"
      >
        <Maximize2 className="size-3.5" aria-hidden />
      </button>
    </div>
  );
}
