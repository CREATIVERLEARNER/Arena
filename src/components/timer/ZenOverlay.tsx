"use client";

import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Minimize2 } from "lucide-react";

import { TimerControls } from "@/components/timer/TimerControls";
import { TimerCore } from "@/components/timer/TimerCore";
import { EASE_VOID } from "@/lib/motion";
import { useTimerStore } from "@/store/useTimerStore";

/**
 * Zen Mode — the void itself. Everything falls away; only the timer remains,
 * centered on pure black. Esc surfaces you back.
 */
export function ZenOverlay() {
  const zenMode = useTimerStore((s) => s.zenMode);
  const status = useTimerStore((s) => s.status);
  const toggleZen = useTimerStore((s) => s.toggleZen);

  // the void holds you still — no scrolling behind it
  useEffect(() => {
    if (!zenMode) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [zenMode]);

  return (
    <AnimatePresence>
      {zenMode && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1, transition: { duration: 1.1, ease: EASE_VOID } }}
          exit={{ opacity: 0, transition: { duration: 0.8, ease: EASE_VOID } }}
          className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-pure"
          role="dialog"
          aria-label="Zen Mode"
        >
          {/* the glow that breathes only while you focus */}
          {status === "running" && (
            <div
              aria-hidden
              className="animate-breathe pointer-events-none absolute left-1/2 top-1/2 h-[40rem] w-[40rem] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[radial-gradient(circle,rgba(139,124,246,0.08)_0%,transparent_65%)]"
            />
          )}

          <TimerCore size="zen" />

          <div className="mt-14">
            <TimerControls compact />
          </div>

          <button
            type="button"
            onClick={toggleZen}
            aria-label="Exit Zen Mode"
            className="absolute right-6 top-6 grid size-9 place-items-center rounded-full text-ghost transition-colors duration-500 hover:text-mist"
          >
            <Minimize2 className="size-4" aria-hidden />
          </button>

          <p className="absolute bottom-8 font-mono text-[9px] tracking-[0.45em] text-ghost uppercase select-none">
            space · begin — r · reset — esc · surface
          </p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
