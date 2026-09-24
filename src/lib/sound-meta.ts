import type { LucideIcon } from "lucide-react";
import { CloudRain, Coffee, Flame, Sparkles, TreePine, Waves } from "lucide-react";

export type SoundId = "rain" | "deep-space" | "white-noise" | "fire" | "cafe" | "forest";

export interface SoundMeta {
  id: SoundId;
  name: string;
  icon: LucideIcon;
}

/** The sanctuary palette — six voices, synthesized live in the browser. */
export const SOUNDS: readonly SoundMeta[] = [
  { id: "rain", name: "Rain", icon: CloudRain },
  { id: "deep-space", name: "Deep Space", icon: Sparkles },
  { id: "white-noise", name: "White Noise", icon: Waves },
  { id: "fire", name: "Crackling Fire", icon: Flame },
  { id: "cafe", name: "Café", icon: Coffee },
  { id: "forest", name: "Forest Night", icon: TreePine },
] as const;

export const SOUND_IDS: readonly SoundId[] = SOUNDS.map((sound) => sound.id);

export const DEFAULT_VOLUME = 50;
