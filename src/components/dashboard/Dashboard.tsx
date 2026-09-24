"use client";

import { useState } from "react";

import { Header } from "@/components/dashboard/Header";
import { TimerSection } from "@/components/dashboard/TimerSection";
import { SoundPanel } from "@/components/sound/SoundPanel";
import { TaskSection } from "@/components/tasks/TaskSection";
import { useStoreHydrated } from "@/hooks/useStoreHydration";
import { cn } from "@/lib/utils";
import { useTaskStore } from "@/store/useTaskStore";
import { useTimerStore } from "@/store/useTimerStore";

/**
 * The Sanctuary — a single dark column holding the timer, the ambient mixer
 * and the Void List. Content fades in only after the stores have rehydrated,
 * so the first paint is always serene (no flashed defaults).
 */
export function Dashboard() {
  const [soundOpen, setSoundOpen] = useState(false);

  const tasksHydrated = useStoreHydrated(useTaskStore);
  const timerHydrated = useStoreHydrated(useTimerStore);
  const hydrated = tasksHydrated && timerHydrated;

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* permanent halo — the room the sanctuary sits in */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,124,246,0.05)_0%,transparent_65%)]"
      />

      <Header soundOpen={soundOpen} onToggleSound={() => setSoundOpen((open) => !open)} />

      <main className="mx-auto w-full max-w-2xl grow px-5 sm:px-8">
        <div
          className={cn(
            "transition-opacity duration-1000 ease-[cubic-bezier(0.16,1,0.3,1)]",
            hydrated ? "opacity-100" : "opacity-0",
          )}
        >
          <TimerSection />
          <SoundPanel open={soundOpen} />
          <TaskSection />
        </div>
      </main>

      {/* floor breathing room */}
      <div className="h-16" aria-hidden />
    </div>
  );
}
