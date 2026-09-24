"use client";

import { formatClock } from "@/lib/time";
import { useStoreHydrated } from "@/hooks/useStoreHydration";
import { useTaskStore } from "@/store/useTaskStore";
import { useTimerStore } from "@/store/useTimerStore";

/**
 * Phase 1 sanity check — a quiet pulse at the bottom of the placeholder page
 * proving the Zustand stores hydrate from LocalStorage and react to state.
 * It retires when the real dashboard arrives in Phase 2.
 */
export function StoreHeartbeat() {
  const tasksHydrated = useStoreHydrated(useTaskStore);
  const timerHydrated = useStoreHydrated(useTimerStore);

  const mode = useTimerStore((s) => s.mode);
  const remainingSeconds = useTimerStore((s) => s.remainingSeconds);
  const taskCount = useTaskStore((s) => s.tasks.length);

  const hydrated = tasksHydrated && timerHydrated;

  return (
    <div
      className="absolute bottom-8 left-1/2 flex -translate-x-1/2 items-center gap-3 font-mono text-[11px] whitespace-nowrap text-faint"
      aria-live="polite"
    >
      <span
        className={`size-1.5 rounded-full transition-opacity duration-1000 ${
          hydrated ? "bg-glow animate-breathe" : "bg-ghost opacity-40"
        }`}
      />
      <span className="animate-fade-in">
        {hydrated
          ? `stores online · ${mode} ${formatClock(remainingSeconds)} · ${taskCount} ${
              taskCount === 1 ? "task" : "tasks"
            }`
          : "waking stores…"}
      </span>
    </div>
  );
}
