"use client";

import { useState } from "react";

import { Header } from "@/components/dashboard/Header";
import { SoundPanel } from "@/components/sound/SoundPanel";
import { TaskSection } from "@/components/tasks/TaskSection";
import { TimerSection } from "@/components/timer/TimerSection";
import { ZenOverlay } from "@/components/timer/ZenOverlay";
import { useAudioBridge } from "@/hooks/useAudioBridge";
import { useStoreHydrated } from "@/hooks/useStoreHydration";
import { useTimerEngine } from "@/hooks/useTimerEngine";
import { useTimerShortcuts } from "@/hooks/useTimerShortcuts";
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

  const running = useTimerStore((s) => s.status === "running");

  // the heartbeat, the keyboard rituals, and the soundboard bridge live at the root
  useTimerEngine();
  useTimerShortcuts();
  useAudioBridge();

  return (
    <div className="relative flex min-h-dvh flex-col">
      {/* the room's halo — it breathes only while you focus */}
      <div
        aria-hidden
        className={cn(
          "pointer-events-none absolute left-1/2 top-0 h-[34rem] w-[34rem] -translate-x-1/2 -translate-y-1/2 rounded-full transition-opacity duration-1000",
          running
            ? "animate-breathe bg-[radial-gradient(circle,rgba(139,124,246,0.09)_0%,transparent_65%)]"
            : "bg-[radial-gradient(circle,rgba(139,124,246,0.05)_0%,transparent_65%)]",
        )}
      />

      <Header
        soundOpen={soundOpen}
        onToggleSound={() => setSoundOpen((open) => !open)}
      />

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

      <ZenOverlay />
    </div>
  );
}
