// Standalone demo of the Jarvis voice-chat visuals (particle orb + dot matrix).
import React, { useEffect, useMemo, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ParticleSphere } from './particle-sphere';
import type { SphereMode, SphereTheme } from './particle-sphere-core';
import {
  createPulseFrames,
  createRadialWaveFrames,
  createWaveFrames,
  Matrix,
} from './matrix';

const MODES: SphereMode[] = ['idle', 'listening', 'speaking', 'processing'];
type VisualStyle = 'orb' | 'matrix';

// Mirrors the ChatView dot-matrix setup (17x17 grid, same frames/palette).
const MATRIX_ROWS = 17;
const MATRIX_COLS = 17;
const IDLE_FRAMES = createPulseFrames(MATRIX_ROWS);
const SPEAKING_FRAMES = createWaveFrames(MATRIX_ROWS, MATRIX_COLS);
const PROCESSING_FRAMES = createRadialWaveFrames(MATRIX_ROWS);

const MATRIX_MOTION: Record<SphereMode, { brightness: number; fps: number }> = {
  idle: { brightness: 0.58, fps: 10 },
  listening: { brightness: 0.9, fps: 18 },
  speaking: { brightness: 0.82, fps: 20 },
  processing: { brightness: 0.96, fps: 16 },
};

const MATRIX_PALETTE: Record<SphereTheme, { on: string; off: string }> = {
  light: { on: 'rgba(24, 24, 24, 0.96)', off: 'rgba(148, 156, 165, 0.4)' },
  dark: { on: 'rgba(245, 247, 250, 0.96)', off: 'rgba(148, 163, 184, 0.24)' },
};

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

// Same shape as ChatView's VU levels: slider level + synthetic waves.
function createVuLevels(phase: number, audioLevel: number): number[] {
  const base = audioLevel > 0 ? clamp(0.18 + audioLevel * 2.9) : 0.42 + Math.sin(phase * 0.42) * 0.12;
  const center = (MATRIX_COLS - 1) / 2;
  return Array.from({ length: MATRIX_COLS }, (_, index) => {
    const centerBoost = 1 - Math.abs(index - center) / center;
    const fastWave = Math.sin(phase * 0.72 + index * 0.86) * 0.17;
    const slowWave = Math.sin(phase * 0.25 + index * 1.38) * 0.08;
    return clamp(base * (0.5 + centerBoost * 0.7) + fastWave + slowWave);
  });
}

function MatrixStage({ mode, theme, audio }: { mode: SphereMode; theme: SphereTheme; audio: number }) {
  const [phase, setPhase] = useState(0);

  useEffect(() => {
    if (mode !== 'listening') return undefined;
    const interval = window.setInterval(() => setPhase(p => p + 1), 90);
    return () => window.clearInterval(interval);
  }, [mode]);

  const vuLevels = useMemo(() => createVuLevels(phase, audio), [phase, audio]);
  const motion = MATRIX_MOTION[mode];
  const matrixProps = mode === 'listening'
    ? { mode: 'vu' as const, levels: vuLevels, frames: undefined }
    : {
        mode: 'default' as const,
        levels: undefined,
        frames: mode === 'processing' ? PROCESSING_FRAMES : mode === 'speaking' ? SPEAKING_FRAMES : IDLE_FRAMES,
      };

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <Matrix
        key={mode}
        rows={MATRIX_ROWS}
        cols={MATRIX_COLS}
        mode={matrixProps.mode}
        levels={matrixProps.levels}
        frames={matrixProps.frames}
        fps={motion.fps}
        size={18}
        gap={10}
        brightness={motion.brightness}
        palette={MATRIX_PALETTE[theme]}
        ariaLabel={mode}
      />
    </div>
  );
}

function App() {
  const [visual, setVisual] = useState<VisualStyle>('orb');
  const [mode, setMode] = useState<SphereMode>('idle');
  const [theme, setTheme] = useState<SphereTheme>('light');
  const [audio, setAudio] = useState(0);

  const bg = theme === 'light' ? '#f4f4fb' : '#0b0b12';
  const fg = theme === 'light' ? '#222' : '#eee';

  return (
    <div style={{ background: bg, color: fg, minHeight: '100vh', margin: 0, fontFamily: 'sans-serif' }}>
      <div style={{ padding: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
        {(['orb', 'matrix'] as VisualStyle[]).map(v => (
          <button key={v} id={`btn-visual-${v}`} onClick={() => setVisual(v)}
            style={{ padding: '6px 12px', fontWeight: visual === v ? 700 : 400 }}>
            {v === 'orb' ? '粒子星球 orb' : '点阵 matrix'}
          </button>
        ))}
        <span style={{ opacity: 0.4 }}>|</span>
        {MODES.map(m => (
          <button key={m} id={`btn-${m}`} onClick={() => setMode(m)}
            style={{ padding: '6px 12px', fontWeight: mode === m ? 700 : 400 }}>
            {m}
          </button>
        ))}
        <button id="btn-theme" onClick={() => setTheme(t => (t === 'light' ? 'dark' : 'light'))}>
          theme: {theme}
        </button>
        <label>
          audio
          <input id="audio-slider" type="range" min="0" max="100" value={audio * 100}
            onChange={e => setAudio(Number(e.target.value) / 100)} />
        </label>
        <span id="state">{visual}/{mode}/{theme}/{audio.toFixed(2)}</span>
      </div>
      <div style={{ width: 520, height: 520, margin: '0 auto' }}>
        {visual === 'orb' ? (
          <ParticleSphere
            mode={mode}
            audioLevel={mode === 'listening' ? audio : null}
            theme={theme}
          />
        ) : (
          <MatrixStage mode={mode} theme={theme} audio={audio} />
        )}
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById('root')!);
root.render(<App />);
