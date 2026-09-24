"use client";

import { useEffect } from "react";

import { audioEngine } from "@/lib/audio/engine";
import { SOUND_IDS } from "@/lib/sound-meta";
import { useSoundStore } from "@/store/useSoundStore";

/**
 * The one-way bridge between mixer state and the audio engine.
 * Store changes flow down into Web Audio; nothing flows back up.
 * Also unlocks the context on the first user gesture, so voices that were
 * active in a previous session can reawaken even under autoplay policy.
 */
export function useAudioBridge(): void {
  const active = useSoundStore((s) => s.active);
  const volumes = useSoundStore((s) => s.volumes);

  useEffect(() => {
    for (const id of SOUND_IDS) {
      audioEngine.setVolume(id, (volumes[id] ?? 0) / 100);
      if (active[id]) void audioEngine.start(id);
      else audioEngine.stop(id);
    }
  }, [active, volumes]);

  useEffect(() => {
    const unlock = () => audioEngine.unlock();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);
}
