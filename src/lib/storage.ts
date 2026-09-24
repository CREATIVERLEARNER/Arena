/**
 * Storage abstraction — LocalStorage today, Supabase/Firebase tomorrow.
 *
 * Zustand's `persist` middleware only needs these three methods, so any
 * backend that can read/write a JSON string blob can plug in later without
 * touching a single store or component:
 *
 *   const supabaseAdapter: StorageAdapter = {
 *     getItem: async (key) => (await supabase.from("void_state").select("value").eq("key", key)).data?.value ?? null,
 *     setItem: async (key, value) => supabase.from("void_state").upsert({ key, value }),
 *     removeItem: (key) => supabase.from("void_state").delete().eq("key", key),
 *   };
 *
 * Then swap `createJSONStorage(() => localStorageAdapter)` for the cloud
 * adapter (or a hybrid that mirrors local → cloud) in the stores.
 */

export interface StorageAdapter {
  getItem: (name: string) => string | null | Promise<string | null>;
  setItem: (name: string, value: string) => void | Promise<void>;
  removeItem: (name: string) => void | Promise<void>;
}

/** Browser LocalStorage adapter; safe on the server (no-ops). */
export const localStorageAdapter: StorageAdapter = {
  getItem: (name) => {
    if (typeof window === "undefined") return null;
    try {
      return window.localStorage.getItem(name);
    } catch {
      return null; // private mode / storage disabled
    }
  },
  setItem: (name, value) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(name, value);
    } catch {
      // quota exceeded / storage disabled — fail silently, focus is precious
    }
  },
  removeItem: (name) => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.removeItem(name);
    } catch {
      // ignore
    }
  },
};
