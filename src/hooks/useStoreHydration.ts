"use client";

import { useSyncExternalStore } from "react";

/**
 * Returns `true` once a persisted Zustand store has rehydrated from
 * LocalStorage on the client. Components gate persisted rendering behind this
 * to avoid SSR/CSR hydration mismatches (server renders empty, client fades in).
 */

type PersistedStore = {
  persist: {
    hasHydrated: () => boolean;
    onFinishHydration: (fn: () => void) => () => void;
  };
};

export function useStoreHydrated(store: PersistedStore): boolean {
  return useSyncExternalStore(
    (onChange) => store.persist.onFinishHydration(onChange),
    () => store.persist.hasHydrated(),
    () => false, // server snapshot — assume not hydrated
  );
}
