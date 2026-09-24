"use client";

import { useEffect } from "react";

import { useTimerStore } from "@/store/useTimerStore";

/**
 * Global keyboard rituals for the sanctuary:
 *   Space — begin / pause      R — reset
 *   Z     — enter / leave Zen  Esc — leave Zen
 *
 * Ignored while typing in inputs, and on focused buttons (they handle Space
 * natively) so nothing ever double-fires.
 */
export function useTimerShortcuts() {
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return;

      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "BUTTON" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      const store = useTimerStore.getState();
      switch (event.code) {
        case "Space": {
          event.preventDefault();
          if (store.status === "running") store.pause();
          else store.start();
          break;
        }
        case "KeyR":
          store.reset();
          break;
        case "KeyZ":
          store.toggleZen();
          break;
        case "Escape":
          if (store.zenMode) store.toggleZen();
          break;
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);
}
