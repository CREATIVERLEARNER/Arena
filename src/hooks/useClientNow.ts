"use client";

import { useSyncExternalStore } from "react";

const noopSubscribe = () => () => {};

// cached so getSnapshot stays referentially stable across calls
let cachedNow: Date | null = null;
const getClientNow = () => (cachedNow ??= new Date());
const getServerNow = () => null;

/**
 * The current date, client-side only. The server snapshot is `null`, so SSR
 * renders nothing and the label fades in with the visitor's own locale/timezone.
 */
export function useClientNow(): Date | null {
  return useSyncExternalStore(noopSubscribe, getClientNow, getServerNow);
}
