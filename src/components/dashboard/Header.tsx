"use client";

import { Volume2 } from "lucide-react";

import { useClientNow } from "@/hooks/useClientNow";
import { useStoreHydrated } from "@/hooks/useStoreHydration";
import { formatDuration } from "@/lib/time";
import { cn } from "@/lib/utils";
import { selectTodayFocusSeconds, useTimerStore } from "@/store/useTimerStore";

interface HeaderProps {
  soundOpen: boolean;
  onToggleSound: () => void;
}

export function Header({ soundOpen, onToggleSound }: HeaderProps) {
  const now = useClientNow(); // client-only: locale & timezone belong to the visitor

  const hydrated = useStoreHydrated(useTimerStore);
  const todayFocusSeconds = useTimerStore(selectTodayFocusSeconds);

  const dateLabel = now?.toLocaleDateString(undefined, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <header className="sticky top-0 z-10 border-b border-line/50 bg-void/80 backdrop-blur-sm">
      <div className="mx-auto flex h-14 w-full max-w-2xl items-center justify-between gap-4 px-5 sm:px-8">
        <p className="select-none pl-[0.35em] font-mono text-[11px] tracking-[0.45em] text-silver">
          VOID
        </p>

        <div className="flex items-center gap-3 sm:gap-4">
          <p className="font-mono text-[10px] tracking-[0.2em] text-ghost uppercase sm:text-[11px]">
            {dateLabel && <span className="hidden sm:inline">{dateLabel}</span>}
            <span className="hidden sm:inline text-line"> · </span>
            <span
              className={cn(
                "transition-opacity duration-700",
                hydrated ? "opacity-100" : "opacity-0",
              )}
            >
              {formatDuration(todayFocusSeconds)} today
            </span>
          </p>

          <button
            type="button"
            onClick={onToggleSound}
            aria-pressed={soundOpen}
            aria-label={soundOpen ? "Close sanctuary soundboard" : "Open sanctuary soundboard"}
            className={cn(
              "grid size-8 place-items-center rounded-full border transition-all duration-500",
              soundOpen
                ? "border-glow/40 bg-glow/10 text-silver shadow-[0_0_16px_rgba(139,124,246,0.15)]"
                : "border-line text-faint hover:border-ghost hover:text-silver",
            )}
          >
            <Volume2 className="size-3.5" aria-hidden />
          </button>
        </div>
      </div>
    </header>
  );
}
