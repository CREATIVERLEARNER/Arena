"use client";

import { formatClock } from "@/lib/time";
import { timerModeMeta } from "@/lib/timer-meta";
import { cn } from "@/lib/utils";
import {
  selectTimerProgress,
  useTimerStore,
} from "@/store/useTimerStore";

import { ProgressRing } from "@/components/timer/ProgressRing";

interface TimerCoreProps {
  size?: "default" | "zen";
}

/**
 * The heart — ring, clock, and a whisper of status, composed so it can beat
 * both on the dashboard and alone in the void (Zen Mode).
 */
export function TimerCore({ size = "default" }: TimerCoreProps) {
  const mode = useTimerStore((s) => s.mode);
  const status = useTimerStore((s) => s.status);
  const isBreak = useTimerStore((s) => s.isBreak);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const elapsedSeconds = useTimerStore((s) => s.elapsedSeconds);
  const progress = useTimerStore(selectTimerProgress);

  const running = status === "running";
  const displaySeconds = mode === "stopwatch" ? elapsedSeconds : remainingSeconds;

  const statusLabel = isBreak
    ? status === "finished"
      ? "break complete"
      : "break"
    : status === "finished"
      ? "session complete"
      : status === "running"
        ? "focus"
        : status === "paused"
          ? "paused"
          : timerModeMeta(mode).hint;

  return (
    <div className="relative grid place-items-center">
      <ProgressRing progress={progress} glowing={running} size={size} />

      <div className="absolute inset-0 grid place-items-center">
        <div className="select-none text-center">
          <p
            className={cn(
              "font-mono leading-none font-extralight tracking-[-0.02em] text-silver tabular-nums",
              size === "zen"
                ? "text-7xl sm:text-8xl"
                : "text-[3.1rem] sm:text-[3.7rem]",
            )}
          >
            {formatClock(displaySeconds)}
          </p>
          <p
            className={cn(
              "mt-4 font-mono text-[10px] tracking-[0.35em] uppercase transition-colors duration-1000",
              status === "finished" ? "animate-pulse text-mist" : "text-faint",
            )}
          >
            {statusLabel}
          </p>
        </div>
      </div>
    </div>
  );
}
