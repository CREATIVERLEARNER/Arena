import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";

import { DEFAULT_VOLUME, SOUND_IDS, type SoundId } from "@/lib/sound-meta";
import { localStorageAdapter } from "@/lib/storage";

const initialVolumes = (): Record<SoundId, number> =>
  Object.fromEntries(SOUND_IDS.map((id) => [id, DEFAULT_VOLUME])) as Record<SoundId, number>;

const initialActive = (): Record<SoundId, boolean> =>
  Object.fromEntries(SOUND_IDS.map((id) => [id, false])) as Record<SoundId, boolean>;

interface SoundState {
  /** Per-sound fader, 0–100. */
  volumes: Record<SoundId, number>;
  /** Which voices the user left sounding — restored on their next visit. */
  active: Record<SoundId, boolean>;
  setVolume: (id: SoundId, volume: number) => void;
  toggle: (id: SoundId) => void;
}

/**
 * The mixer's memory. Both the mix and the "which voices are on" state
 * persist, so your sanctuary sounds like you left it.
 */
export const useSoundStore = create<SoundState>()(
  persist(
    (set) => ({
      volumes: initialVolumes(),
      active: initialActive(),

      setVolume: (id, volume) =>
        set((state) => ({
          volumes: { ...state.volumes, [id]: Math.min(100, Math.max(0, Math.round(volume))) },
        })),

      toggle: (id) =>
        set((state) => {
          const activating = !state.active[id];
          const current = state.volumes[id] ?? 0;
          return {
            active: { ...state.active, [id]: activating },
            // switching a silent voice on gives it a sane starting level
            volumes:
              activating && current === 0
                ? { ...state.volumes, [id]: DEFAULT_VOLUME }
                : state.volumes,
          };
        }),
    }),
    {
      name: "void:sounds",
      version: 1,
      storage: createJSONStorage(() => localStorageAdapter),
    },
  ),
);
