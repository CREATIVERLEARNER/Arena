"use client";

import { AnimatePresence, motion } from "framer-motion";

import { Slider } from "@/components/ui/Slider";
import { audioEngine } from "@/lib/audio/engine";
import { EASE_VOID } from "@/lib/motion";
import { SOUNDS, SOUND_IDS, type SoundMeta } from "@/lib/sound-meta";
import { cn } from "@/lib/utils";
import { useSoundStore } from "@/store/useSoundStore";

interface SoundToggleProps {
  meta: SoundMeta;
  volume: number;
  active: boolean;
  onToggle: () => void;
  onVolumeChange: (volume: number) => void;
}

/** One voice of the sanctuary: a summoning sigil, its name, its own fader. */
function SoundToggle({ meta, volume, active, onToggle, onVolumeChange }: SoundToggleProps) {
  const Icon = meta.icon;
  return (
    <div className="flex items-center gap-3 border-b border-line/40 py-3 last:border-b-0">
      <button
        type="button"
        onClick={() => {
          audioEngine.unlock(); // the click itself is the gesture that resumes audio
          onToggle();
        }}
        aria-pressed={active}
        aria-label={`${active ? "Silence" : "Summon"} ${meta.name}`}
        className={cn(
          "grid size-8 shrink-0 place-items-center rounded-full border transition-all duration-700 ease-[cubic-bezier(0.16,1,0.3,1)]",
          active
            ? "border-glow/40 bg-glow/10 text-glow/90 shadow-[0_0_16px_rgba(139,124,246,0.18)]"
            : "border-line text-faint hover:border-ghost hover:text-mist",
        )}
      >
        <Icon className="size-3.5" aria-hidden />
      </button>

      <span
        className={cn(
          "flex-1 truncate text-sm font-light transition-colors duration-700",
          active ? "text-mist" : "text-faint",
        )}
      >
        {meta.name}
      </span>

      <Slider
        value={volume}
        onValueChange={onVolumeChange}
        aria-label={`${meta.name} volume`}
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
 * The Sanctuary soundboard — a collapsible mixing desk for six synthesized
 * ambiences. The mix and which voices are sounding both persist across visits.
 */
export function SoundPanel({ open }: SoundPanelProps) {
  const volumes = useSoundStore((s) => s.volumes);
  const active = useSoundStore((s) => s.active);
  const setVolume = useSoundStore((s) => s.setVolume);
  const toggle = useSoundStore((s) => s.toggle);

  const playingCount = SOUND_IDS.filter((id) => active[id]).length;

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
                {playingCount > 0 ? `${playingCount} sounding` : "silence"}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 sm:gap-x-10">
              {SOUNDS.map((meta) => (
                <SoundToggle
                  key={meta.id}
                  meta={meta}
                  volume={volumes[meta.id] ?? 0}
                  active={active[meta.id] ?? false}
                  onToggle={() => toggle(meta.id)}
                  onVolumeChange={(volume) => setVolume(meta.id, volume)}
                />
              ))}
            </div>

            <p className="mt-4 text-right font-mono text-[9px] tracking-[0.25em] text-ghost/70 uppercase">
              synthesized live · web audio · no files
            </p>
          </section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
