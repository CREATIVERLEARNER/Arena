"use client";

import { cn } from "@/lib/utils";

const RADIUS = 150;
const CIRCUMFERENCE = 2 * Math.PI * RADIUS;

interface ProgressRingProps {
  /** 0 → 1 — how much of the session has drained. */
  progress: number;
  /** True while the timer runs — the ring ignites with its dim glow. */
  glowing: boolean;
  size?: "default" | "zen";
}

/**
 * The Void ring — a hairline track that drains as the session passes.
 * The offset is updated a few times a second and eased by CSS, so the
 * motion glides without a re-render per frame.
 */
export function ProgressRing({ progress, glowing, size = "default" }: ProgressRingProps) {
  return (
    <div
      className={cn(
        "relative",
        size === "zen"
          ? "h-[min(76vw,26rem)] w-[min(76vw,26rem)]"
          : "h-64 w-64 sm:h-80 sm:w-80",
      )}
      aria-hidden
    >
      <svg viewBox="0 0 320 320" className="h-full w-full -rotate-90">
        <circle
          cx={160}
          cy={160}
          r={RADIUS}
          fill="none"
          stroke="rgba(39, 39, 42, 0.7)"
          strokeWidth={1.5}
        />
        <circle
          cx={160}
          cy={160}
          r={RADIUS}
          fill="none"
          stroke="#8b7cf6"
          strokeOpacity={glowing ? 0.85 : 0.55}
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={CIRCUMFERENCE * (1 - progress)}
          className={cn(
            "transition-[stroke-dashoffset,stroke-opacity] duration-1000 ease-linear",
            glowing && "drop-shadow-[0_0_8px_rgba(139,124,246,0.45)]",
          )}
        />
      </svg>
    </div>
  );
}
