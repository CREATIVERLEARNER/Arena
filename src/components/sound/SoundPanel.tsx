"use client";

import { useState } from "react";
import { CloudRain, Coffee, Flame, Sparkles, TreePine, Waves, type LucideIcon } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

import { Slider } from "@/components/ui/Slider";
import { EASE_VOID } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface SoundDef {
  id: string;
  name: string;
  icon: LucideIcon;
}

/** The sanctuary palette — six loops to mix. Audio engine arrives in Phase 4. */
const SOUNDS: readonly SoundDef[] = [
  { id: "rain", name: "Rain", icon: CloudRain },
  { id: "deep-space", name: "Deep Space", icon: Sparkles },
  { id: "white-noise", name: "White Noise", icon: Waves },
  { id: "fire", name: "Crackling Fire", icon: Flame },
  { id: "cafe", name: "Café", icon: Coffee },
  { id: "forest", name: "Forest Night", icon: TreePine },
] as const;

interface SoundToggleProps {
  name: string;
  icon: LucideIcon;
  volume: number;
  onVolumeChange: (volume: number) => void;
}

/** One voice of the sanctuary: icon, name, and its own volume fader. */
function SoundToggle({ name, icon: Icon, volume, onVolumeChange }: SoundToggleProps) {
  const active = volume > 0;
  return (
    <div className="flex items-center gap-3 border-b border-line/40 py-3 last:border-b-0">
      <Icon
        aria-hidden
        className={cn(
          "size-4 shrink-0 transition-colors duration-700",
          active ? "text-glow/70" : "text-faint",
        )}
      />
      <span
        className={cn(
          "flex-1 truncate text-sm font-light transition-colors duration-700",
          active ? "text-mist" : "text-faint",
        )}
      >
        {name}
      </span>
      <Slider
        value={volume}
        onValueChange={onVolumeChange}
        aria-label={`${name} volume`}
        className="w-28 sm:w-32"
      />
      <span className="w-7 text-right font-mono text-[10px] text-ghost tabular-nums">
        {volume}
      </span>
    </div>
  );
}

interface SoundPanelProps {
  open: boolean;
}

/**
 * The Sanctuary soundboard — collapsible panel beneath the header.
 * Phase 4 wires these faders to real ambient loops; Phase 5 persists the mix.
 */
export function SoundPanel({ open }: SoundPanelProps) {
  // presentational state until the audio engine lands
  const [volumes, setVolumes] = useState<Record<string, number>>(() =>
    Object.fromEntries(SOUNDS.map((sound) => [sound.id, 0])),
  );

  const playingCount = Object.values(volumes).filter((v) => v > 0).length;

  return (
    <AnimatePresence initial={false}>
      {open && (
        <motion.div
          initial={{ height: 0, opacity: 0 }}
          animate={{ height: "auto", opacity: 1, transition: { duration: 0.7, ease: EASE_VOID } }}
          exit={{ height: 0, opacity: 0, transition: { duration: 0.6, ease: EASE_VOID } }}
          className="overflow-hidden"
        >
          <section aria-label="Sanctuary soundboard" className="my-2 border-y border-line/50 py-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-mono text-[10px] tracking-[0.35em] text-faint uppercase">
                Sanctuary · ambient mixer
              </h2>
              <p className="font-mono text-[10px] tracking-[0.2em] text-ghost uppercase">
                {playingCount > 0 ? `${playingCount} playing` : "silence"}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-10">
              {SOUNDS.map((sound) => (
                <SoundToggle
                  key={sound.id}
                  name={sound.name}
                  icon={sound.icon}
                  volume={volumes[sound.id] ?? 0}
                  onVolumeChange={(volume) =>
                    setVolumes((prev) => ({ ...prev, [sound.id]: volume }))
                  }
                />
              ))}
            </div>

            <p className="mt-4 text-right font-mono text-[9px] tracking-[0.25em] text-ghost/70 uppercase">
              audio loops arrive in phase 4
            </p>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
