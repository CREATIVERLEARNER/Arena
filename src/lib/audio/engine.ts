import type { SoundId } from "@/lib/sound-meta";

import { createVoice, type Voice } from "@/lib/audio/voices";

/**
 * The Sanctuary engine — a singleton owning the AudioContext, a master bus,
 * and the currently sounding voices. The UI never touches Web Audio directly;
 * it talks to this engine through the useAudioBridge hook.
 *
 * Fades live here so toggles never click. Autoplay policy is handled by
 * `unlock()` — called on the first user gesture — which resumes a suspended
 * context so persisted sound states can reawaken.
 */
class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private voices = new Map<SoundId, Voice>();
  private stopping = new Map<SoundId, Voice>();
  private stopTimers = new Map<SoundId, ReturnType<typeof setTimeout>>();
  private volumes = new Map<SoundId, number>();

  private ensureContext(): AudioContext | null {
    if (typeof window === "undefined") return null;
    if (!this.ctx) {
      const Ctor =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.9;
      this.master.connect(this.ctx.destination);
    }
    return this.ctx;
  }

  /** Resume the context — must originate from a user gesture. */
  unlock(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume().catch(() => {});
  }

  async start(id: SoundId): Promise<void> {
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    this.clearStopTimer(id);

    // a voice caught mid-fade-out simply turns back around
    const reviving = this.stopping.get(id);
    if (reviving) {
      this.stopping.delete(id);
      this.voices.set(id, reviving);
      this.applyVolume(id, true);
      return;
    }

    if (this.voices.has(id)) {
      this.applyVolume(id);
      return;
    }

    try {
      await ctx.resume();
    } catch {
      // stays suspended until the next user gesture — unlock() will handle it
    }

    const voice = createVoice(id, ctx, this.master);
    voice.output.gain.setValueAtTime(0.0001, ctx.currentTime);
    this.voices.set(id, voice);
    this.applyVolume(id, true);
  }

  stop(id: SoundId): void {
    const voice = this.voices.get(id);
    if (!voice || !this.ctx) return;

    const now = this.ctx.currentTime;
    voice.output.gain.cancelScheduledValues(now);
    voice.output.gain.setTargetAtTime(0.0001, now, 0.15);
    this.voices.delete(id);
    this.stopping.set(id, voice);

    this.stopTimers.set(
      id,
      setTimeout(() => {
        voice.stop();
        this.stopping.delete(id);
        this.stopTimers.delete(id);
      }, 700),
    );
  }

  /** 0..1 perceptual volume, applied with a short fade. */
  setVolume(id: SoundId, value01: number): void {
    this.volumes.set(id, Math.min(1, Math.max(0, value01)));
    this.applyVolume(id);
  }

  private applyVolume(id: SoundId, fadeFromZero = false): void {
    const voice = this.voices.get(id);
    if (!voice || !this.ctx) return;

    const slider01 = this.volumes.get(id) ?? 0;
    const target = Math.max(0.0001, Math.pow(slider01, 1.5) * 0.8);
    const now = this.ctx.currentTime;

    if (fadeFromZero) voice.output.gain.setValueAtTime(0.0001, now);
    voice.output.gain.setTargetAtTime(target, now, 0.25);
  }

  private clearStopTimer(id: SoundId): void {
    const timer = this.stopTimers.get(id);
    if (timer) {
      clearTimeout(timer);
      this.stopTimers.delete(id);
    }
  }
}

export const audioEngine = new AudioEngine();
