// Pure logic for the ParticleSphere visual: sphere point distribution, the
// per-mode motion parameters, and audio smoothing. Kept free of DOM/WebGL so
// it can be unit-tested under the node jest environment.
//
// Distribution + hover-repulsion approach adapted from
// SafarSoFar/sphere-particle-wrap (uniform Fibonacci sphere, particles pushed
// outward near the cursor); audio → radius mapping follows the
// aaronhans/webaudioviz pattern (fast attack, slow release, level inflates
// the sphere and adds vibration).

export type SphereMode = 'idle' | 'listening' | 'speaking' | 'processing';
export type SphereTheme = 'light' | 'dark';

export interface SphereModeParams {
  /** Base Y-axis rotation speed (rad/s). */
  spin: number;
  /** Per-particle counter-churn speed (rad/s) — turbulence while thinking. */
  swirl: number;
  /** Radial breathing amplitude, as a fraction of the radius. */
  breathAmp: number;
  /** Breathing frequency (Hz). */
  breathHz: number;
  /** Per-particle radial noise amplitude. */
  jitter: number;
  /** Traveling polar wave amplitude — the "answering" ripple. */
  waveAmp: number;
  /** Wave travel frequency (Hz). */
  waveHz: number;
  /** Global particle brightness multiplier (0-1+). */
  brightness: number;
  /** How strongly the mic level inflates/vibrates the sphere (0-1). */
  audioGain: number;
}

export const SPHERE_MODE_PARAMS: Record<SphereMode, SphereModeParams> = {
  // 等待 — slow drift, gentle breath, dimmed.
  idle: {
    spin: 0.1,
    swirl: 0,
    breathAmp: 0.018,
    breathHz: 0.22,
    jitter: 0.006,
    waveAmp: 0,
    waveHz: 0,
    brightness: 0.9,
    audioGain: 0,
  },
  // 聆听 — sphere swells and shivers with the live mic level.
  listening: {
    spin: 0.16,
    swirl: 0.15,
    breathAmp: 0.012,
    breathHz: 0.5,
    jitter: 0.012,
    waveAmp: 0.015,
    waveHz: 1.4,
    brightness: 1,
    audioGain: 1,
  },
  // 回答 — rhythmic waves travel across the surface while it speaks.
  speaking: {
    spin: 0.2,
    swirl: 0.25,
    breathAmp: 0.02,
    breathHz: 0.9,
    jitter: 0.01,
    waveAmp: 0.07,
    waveHz: 2,
    brightness: 0.95,
    audioGain: 0,
  },
  // 思考 — fast churn: particles counter-rotate and the sphere pulses.
  processing: {
    spin: 0.55,
    swirl: 1.6,
    breathAmp: 0.03,
    breathHz: 1.1,
    jitter: 0.028,
    waveAmp: 0.02,
    waveHz: 2.4,
    brightness: 1.08,
    audioGain: 0,
  },
};

// Violet/indigo particle palette matching the jarvis.ceo orb. RGB in 0-1.
export const SPHERE_PALETTES: Record<SphereTheme, Array<[number, number, number]>> = {
  light: [
    [0.357, 0.357, 0.839], // indigo #5B5BD6
    [0.486, 0.361, 0.878], // violet #7C5CE0
    [0.545, 0.361, 0.965], // purple #8B5CF6
    [0.655, 0.545, 0.98], // lavender #A78BFA
    [0.388, 0.4, 0.945], // #6366F1
  ],
  dark: [
    [0.506, 0.549, 0.973], // #818CF8
    [0.655, 0.545, 0.98], // #A78BFA
    [0.769, 0.71, 0.992], // #C4B5FD
    [0.545, 0.361, 0.965], // #8B5CF6
    [0.576, 0.773, 0.992], // #93C5FD
  ],
};

export interface SphereAttributes {
  /** Unit directions on the sphere, xyz per particle. */
  directions: Float32Array;
  /** Stable per-particle random seed in [0, 1). */
  rands: Float32Array;
  /** Base point size in CSS px. */
  sizes: Float32Array;
  /** RGB color per particle. */
  colors: Float32Array;
  count: number;
}

/** Deterministic PRNG so the sphere looks identical across mounts and tests. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a += 0x6d2b79f5;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Distribute `count` particles uniformly on a unit sphere via the Fibonacci
 * (golden-angle) spiral, with per-particle size/color/seed attributes.
 */
export function buildSphereAttributes(
  count: number,
  theme: SphereTheme,
  seed = 1337
): SphereAttributes {
  const rand = mulberry32(seed);
  const palette = SPHERE_PALETTES[theme];
  const directions = new Float32Array(count * 3);
  const rands = new Float32Array(count);
  const sizes = new Float32Array(count);
  const colors = new Float32Array(count * 3);

  const golden = Math.PI * (3 - Math.sqrt(5));

  for (let i = 0; i < count; i += 1) {
    const y = count > 1 ? 1 - (i / (count - 1)) * 2 : 0;
    const radius = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = golden * i;

    directions[i * 3] = Math.cos(angle) * radius;
    directions[i * 3 + 1] = y;
    directions[i * 3 + 2] = Math.sin(angle) * radius;

    const r = rand();
    rands[i] = r;
    // Mostly small dots with a few larger ones, like the reference orb.
    sizes[i] = 2.4 + r * r * 4.4;

    const [cr, cg, cb] = palette[Math.floor(rand() * palette.length) % palette.length];
    // Vary mostly downward so the violet stays saturated instead of washing out.
    const tint = 0.78 + rand() * 0.28;
    colors[i * 3] = Math.min(1, cr * tint);
    colors[i * 3 + 1] = Math.min(1, cg * tint);
    colors[i * 3 + 2] = Math.min(1, cb * tint);
  }

  return { directions, rands, sizes, colors, count };
}

/**
 * Frame-rate-independent smoothing of the mic level: fast attack so the
 * sphere jumps with speech, slow release so it settles gently.
 */
export function smoothAudioLevel(current: number, target: number, dtSeconds: number): number {
  const rate = target > current ? 14 : 3.2;
  return current + (target - current) * (1 - Math.exp(-rate * dtSeconds));
}

/** Exponential approach of the animated params toward the active mode's targets. */
export function approachParams(
  current: SphereModeParams,
  target: SphereModeParams,
  dtSeconds: number
): SphereModeParams {
  const k = 1 - Math.exp(-3.5 * dtSeconds);
  const mix = (a: number, b: number) => a + (b - a) * k;
  return {
    spin: mix(current.spin, target.spin),
    swirl: mix(current.swirl, target.swirl),
    breathAmp: mix(current.breathAmp, target.breathAmp),
    breathHz: mix(current.breathHz, target.breathHz),
    jitter: mix(current.jitter, target.jitter),
    waveAmp: mix(current.waveAmp, target.waveAmp),
    waveHz: mix(current.waveHz, target.waveHz),
    brightness: mix(current.brightness, target.brightness),
    audioGain: mix(current.audioGain, target.audioGain),
  };
}
