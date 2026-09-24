"use client";

import { useEffect } from "react";

import { useStoreHydrated } from "@/hooks/useStoreHydration";
import { useTaskStore } from "@/store/useTaskStore";

/**
 * The daily ritual: when a new day dawns, yesterday's dissolved tasks are
 * gone for good and the list belongs to today. Runs once, after hydration.
 */
export function useDailyRollover(): void {
  const hydrated = useStoreHydrated(useTaskStore);

  useEffect(() => {
    if (hydrated) useTaskStore.getState().rolloverIfNeeded();
  }, [hydrated]);
}
