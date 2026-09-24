"use client";

import { useEffect } from "react";

import { useTimerStore } from "@/store/useTimerStore";

const TICK_MS = 250;

/**
 * The timer's heartbeat. A 250ms interval computes deltas from wall-clock
 * timestamps (never by counting ticks), so the countdown stays drift-free
 * and catches up correctly after tab throttling.
 */
export function useTimerEngine() {
  const status = useTimerStore((s) => s.status);

  useEffect(() => {
    if (status !== "running") return;

    let last = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      const deltaSeconds = (now - last) / 1000;
      last = now;
      if (deltaSeconds > 0) useTimerStore.getState().tick(deltaSeconds);
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [status]);
}
