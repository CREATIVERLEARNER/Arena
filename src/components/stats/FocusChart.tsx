"use client";

import { motion } from "framer-motion";

import { EASE_VOID } from "@/lib/motion";
import { formatDuration, lastNDayKeys } from "@/lib/time";
import { cn } from "@/lib/utils";
import { useTimerStore } from "@/store/useTimerStore";

function keyToDate(key: string): Date {
  return new Date(
    Number(key.slice(0, 4)),
    Number(key.slice(5, 7)) - 1,
    Number(key.slice(8, 10)),
  );
}

/**
 * The week at a glance — seven slivers, one per day, scaled to your best day.
 * A quiet bar chart in the spirit of a contribution graph; today glows.
 */
export function FocusChart() {
  const focusLog = useTimerStore((s) => s.focusLog);

  const days = lastNDayKeys(7);
  const values = days.map((key) => focusLog[key] ?? 0);
  const total = values.reduce((sum, seconds) => sum + seconds, 0);
  const max = Math.max(...values, 60); // scale to the best day (floor: 1 minute)
  const todayIndex = days.length - 1;

  return (
    <section aria-label="Focus statistics" className="pb-12">
      <div className="flex items-baseline justify-between">
        <h2 className="font-mono text-[10px] tracking-[0.35em] text-faint uppercase">
          Focus · last 7 days
        </h2>
        <p className="font-mono text-[10px] tracking-[0.2em] text-ghost uppercase">
          {formatDuration(total)} this week
        </p>
      </div>

      <div
        className="mt-5 flex h-24 items-stretch gap-2.5"
        role="img"
        aria-label={`Focus over the last 7 days, ${formatDuration(total)} total`}
      >
        {days.map((key, index) => {
          const seconds = values[index];
          const isToday = index === todayIndex;
          // every day gets a visible sliver; filled days scale to the best day
          const heightPct = Math.max(seconds > 0 ? 8 : 2, (seconds / max) * 100);
          const date = keyToDate(key);
          const letter = date.toLocaleDateString(undefined, { weekday: "narrow" });

          return (
            <div key={key} className="flex h-full flex-1 flex-col items-center gap-2.5">
              <div className="flex w-full flex-1 items-end">
                <motion.div
                  initial={{ height: "2%" }}
                  animate={{ height: `${heightPct}%` }}
                  transition={{ duration: 0.9, ease: EASE_VOID, delay: index * 0.05 }}
                  title={`${date.toLocaleDateString(undefined, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })} — ${formatDuration(seconds)}`}
                  className={cn(
                    "w-full rounded-t-[3px]",
                    seconds > 0
                      ? isToday
                        ? "bg-glow/70 shadow-[0_0_14px_rgba(139,124,246,0.3)]"
                        : "bg-glow/35"
                      : "bg-elevated",
                  )}
                />
              </div>
              <span
                className={cn(
                  "font-mono text-[9px] uppercase",
                  isToday ? "text-faint" : "text-ghost",
                )}
              >
                {letter}
              </span>
            </div>
          );
        })}
      </div>
    </section>
  );
}
