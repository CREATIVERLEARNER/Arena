import type { SoundId } from "@/lib/sound-meta";

/**
 * The Sanctuary's six voices — pure Web Audio synthesis.
 *
 * No files, no network, no licensing: every ambience is generated from noise
 * buffers, oscillators, filters and slow LFOs, so the loops never repeat and
 * never download. Each voice exposes a GainNode (`output`) that the engine
 * alone controls for fades; internal staging uses separate gains.
 */

export interface Voice {
  output: GainNode;
  stop: () => void;
}

type Ctx = AudioContext;

/* ── helpers ────────────────────────────────────────────── */

function makeNoiseBuffer(ctx: Ctx, kind: "white" | "brown", seconds = 3): AudioBuffer {
  const length = Math.floor(ctx.sampleRate * seconds);
  const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  let last = 0;
  for (let i = 0; i < length; i++) {
    const white = Math.random() * 2 - 1;
    if (kind === "white") {
      data[i] = white * 0.6;
    } else {
      // brown noise — integrated white, warmer and deeper
      last = (last + 0.02 * white) / 1.02;
      data[i] = last * 3.2;
    }
  }
  return buffer;
}

function noiseLayer(ctx: Ctx, kind: "white" | "brown"): AudioBufferSourceNode {
  const source = ctx.createBufferSource();
  source.buffer = makeNoiseBuffer(ctx, kind);
  source.loop = true;
  source.start();
  return source;
}

function biquad(ctx: Ctx, type: BiquadFilterType, frequency: number, q?: number): BiquadFilterNode {
  const filter = ctx.createBiquadFilter();
  filter.type = type;
  filter.frequency.value = frequency;
  if (q !== undefined) filter.Q.value = q;
  return filter;
}

function gainNode(ctx: Ctx, value: number): GainNode {
  const gain = ctx.createGain();
  gain.gain.value = value;
  return gain;
}

function tone(ctx: Ctx, frequency: number, type: OscillatorType): OscillatorNode {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  osc.start();
  return osc;
}

interface LfoHandle {
  stop: () => void;
}

/** Slow modulation — the difference between a machine and a living sound. */
function lfo(
  ctx: Ctx,
  frequency: number,
  depth: number,
  target: AudioParam,
  type: OscillatorType = "sine",
): LfoHandle {
  const osc = ctx.createOscillator();
  osc.type = type;
  osc.frequency.value = frequency;
  const gain = gainNode(ctx, depth);
  osc.connect(gain);
  gain.connect(target);
  osc.start();
  return {
    stop: () => {
      try {
        osc.stop();
      } catch {
        // already stopped
      }
      gain.disconnect();
    },
  };
}

/** Collects everything a voice needs to release, so stop() is one call. */
class Reaper {
  private sources: AudioScheduledSourceNode[] = [];
  private lfos: LfoHandle[] = [];

  source<T extends AudioScheduledSourceNode>(node: T): T {
    this.sources.push(node);
    return node;
  }

  mod(handle: LfoHandle): LfoHandle {
    this.lfos.push(handle);
    return handle;
  }

  release(): void {
    for (const source of this.sources) {
      try {
        source.stop();
      } catch {
        // already stopped
      }
    }
    for (const handle of this.lfos) handle.stop();
  }
}

/* ── the voices ─────────────────────────────────────────── */

function rainVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  // high hiss — the body of the rainfall
  const hiss = reaper.source(noiseLayer(ctx, "white"));
  const hp = biquad(ctx, "highpass", 350);
  const lp = biquad(ctx, "lowpass", 5200);
  const hissGain = gainNode(ctx, 0.5);
  hiss.connect(hp).connect(lp).connect(hissGain).connect(output);
  reaper.mod(lfo(ctx, 0.06, 0.12, hissGain.gain));

  // low rumble — the weight of the storm
  const rumble = reaper.source(noiseLayer(ctx, "brown"));
  const rlp = biquad(ctx, "lowpass", 260);
  const rumbleGain = gainNode(ctx, 0.4);
  rumble.connect(rlp).connect(rumbleGain).connect(output);
  reaper.mod(lfo(ctx, 0.043, 0.1, rumbleGain.gain));

  return { output, stop: () => reaper.release() };
}

function deepSpaceVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  // the drone — two detuned saws through a slow-breathing filter
  const lp = biquad(ctx, "lowpass", 240, 0.7);
  const padGain = gainNode(ctx, 0.18);
  const oscA = reaper.source(tone(ctx, 55, "sawtooth"));
  const oscB = reaper.source(tone(ctx, 55.6, "sawtooth"));
  oscA.connect(padGain);
  oscB.connect(padGain);
  padGain.connect(lp).connect(output);
  reaper.mod(lfo(ctx, 0.03, 70, lp.frequency));

  // the sub — felt more than heard
  const sub = reaper.source(tone(ctx, 27.5, "sine"));
  const subGain = gainNode(ctx, 0.12);
  sub.connect(subGain).connect(output);

  // the shimmer — a distant, trembling star
  const shimmer = reaper.source(tone(ctx, 1310, "sine"));
  const shimmerGain = gainNode(ctx, 0.006);
  shimmer.connect(shimmerGain).connect(output);
  reaper.mod(lfo(ctx, 0.09, 0.004, shimmerGain.gain));

  return { output, stop: () => reaper.release() };
}

function whiteNoiseVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  const noise = reaper.source(noiseLayer(ctx, "white"));
  const lp = biquad(ctx, "lowpass", 8500);
  const level = gainNode(ctx, 0.5);
  noise.connect(lp).connect(level).connect(output);

  return { output, stop: () => reaper.release() };
}

function fireVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  // the bed — low ember rumble, flickering slowly
  const bed = reaper.source(noiseLayer(ctx, "brown"));
  const blp = biquad(ctx, "lowpass", 380);
  const bedGain = gainNode(ctx, 0.5);
  bed.connect(blp).connect(bedGain).connect(output);
  reaper.mod(lfo(ctx, 0.11, 0.15, bedGain.gain));
  reaper.mod(lfo(ctx, 0.023, 0.12, bedGain.gain));

  // the crackle — one pre-baked burst, re-fired at random pitches & times
  const burstLength = Math.floor(ctx.sampleRate * 0.05);
  const burst = ctx.createBuffer(1, burstLength, ctx.sampleRate);
  const data = burst.getChannelData(0);
  for (let i = 0; i < burstLength; i++) {
    data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (burstLength / 6));
  }

  let crackleTimer: ReturnType<typeof setTimeout> | null = null;
  let stopped = false;
  const pop = () => {
    if (stopped) return;
    const src = ctx.createBufferSource();
    src.buffer = burst;
    src.playbackRate.value = 0.6 + Math.random() * 1.2;
    const bp = biquad(ctx, "bandpass", 900 + Math.random() * 2200, 1.2);
    const level = gainNode(ctx, 0.08 + Math.random() * 0.25);
    src.connect(bp).connect(level).connect(output);
    src.start(ctx.currentTime + Math.random() * 0.05);
    src.stop(ctx.currentTime + 0.12);
    src.onended = () => level.disconnect();
    crackleTimer = setTimeout(pop, 40 + Math.random() * 400);
  };
  pop();

  return {
    output,
    stop: () => {
      stopped = true;
      if (crackleTimer) clearTimeout(crackleTimer);
      reaper.release();
    },
  };
}

function cafeVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  // the murmur — formant-ish band rolling slowly, like distant conversation
  const murmur = reaper.source(noiseLayer(ctx, "brown"));
  const bp = biquad(ctx, "bandpass", 480, 0.9);
  const murmurGain = gainNode(ctx, 0.55);
  murmur.connect(bp).connect(murmurGain).connect(output);
  reaper.mod(lfo(ctx, 0.31, 180, bp.frequency));
  reaper.mod(lfo(ctx, 0.17, 0.15, murmurGain.gain));
  reaper.mod(lfo(ctx, 0.07, 0.1, murmurGain.gain));

  // the air — a faint hiss of the espresso machine and the room
  const air = reaper.source(noiseLayer(ctx, "white"));
  const alp = biquad(ctx, "lowpass", 2600);
  const airGain = gainNode(ctx, 0.08);
  air.connect(alp).connect(airGain).connect(output);

  return { output, stop: () => reaper.release() };
}

function forestVoice(ctx: Ctx, dest: AudioNode): Voice {
  const reaper = new Reaper();
  const output = gainNode(ctx, 0.0001);
  output.connect(dest);

  // the wind — broad, slow swells through the canopy
  const wind = reaper.source(noiseLayer(ctx, "brown"));
  const wlp = biquad(ctx, "lowpass", 420);
  const windGain = gainNode(ctx, 0.5);
  wind.connect(wlp).connect(windGain).connect(output);
  reaper.mod(lfo(ctx, 0.05, 0.28, windGain.gain));
  reaper.mod(lfo(ctx, 0.011, 0.15, windGain.gain));

  // the crickets — two trills, amplitude-modulated into chirps
  const cricketA = reaper.source(tone(ctx, 4300, "sine"));
  const cricketAGain = gainNode(ctx, 0.012);
  cricketA.connect(cricketAGain).connect(output);
  reaper.mod(lfo(ctx, 16, 0.012, cricketAGain.gain, "square"));

  const cricketB = reaper.source(tone(ctx, 3680, "sine"));
  const cricketBGain = gainNode(ctx, 0.009);
  cricketB.connect(cricketBGain).connect(output);
  reaper.mod(lfo(ctx, 13, 0.009, cricketBGain.gain, "square"));

  return { output, stop: () => reaper.release() };
}

/* ── dispatch ───────────────────────────────────────────── */

export function createVoice(id: SoundId, ctx: Ctx, dest: AudioNode): Voice {
  switch (id) {
    case "rain":
      return rainVoice(ctx, dest);
    case "deep-space":
      return deepSpaceVoice(ctx, dest);
    case "white-noise":
      return whiteNoiseVoice(ctx, dest);
    case "fire":
      return fireVoice(ctx, dest);
    case "cafe":
      return cafeVoice(ctx, dest);
    case "forest":
      return forestVoice(ctx, dest);
  }
}
