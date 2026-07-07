import * as React from 'react';
import { useEffect, useRef, useState } from 'react';
import {
  approachParams,
  buildSphereAttributes,
  smoothAudioLevel,
  SPHERE_MODE_PARAMS,
  SphereMode,
  SphereTheme,
} from './particle-sphere-core';

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

interface ParticleSphereProps extends React.HTMLAttributes<HTMLCanvasElement> {
  /** Voice-chat state driving the animation. */
  mode: SphereMode;
  /** Live mic level in 0-1 (listening only); null when no live audio. */
  audioLevel?: number | null;
  /** Resolved UI theme — selects the particle palette. */
  theme: SphereTheme;
  /** Number of particles on the sphere. */
  particleCount?: number;
  /** Enable the hover repel/scatter interaction. */
  interactive?: boolean;
}

const VERTEX_SHADER = `
precision mediump float;

attribute vec3 a_dir;
attribute float a_rand;
attribute float a_size;
attribute vec3 a_color;

uniform float u_time;
uniform float u_spin;
uniform float u_swirl;
uniform float u_breath;
uniform float u_jitter;
uniform float u_waveAmp;
uniform float u_wavePhase;
uniform float u_audio;
uniform float u_audioGain;
uniform float u_brightness;
uniform float u_aspect;
uniform float u_dpr;
uniform vec2 u_mouse;
uniform float u_mouseActive;

varying vec3 v_color;
varying float v_alpha;

const float CAM_DIST = 2.7;
const float FOV = 2.0;

vec3 rotateY(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(c * p.x + s * p.z, p.y, -s * p.x + c * p.z);
}

vec3 rotateX(vec3 p, float a) {
  float c = cos(a);
  float s = sin(a);
  return vec3(p.x, c * p.y - s * p.z, s * p.y + c * p.z);
}

void main() {
  // Base spin plus per-particle counter-churn (turbulence while thinking).
  float angle = u_spin + u_swirl * (a_rand - 0.5) * 2.0;
  vec3 dir = rotateY(a_dir, angle);
  dir = rotateX(dir, 0.3 + sin(u_time * 0.11) * 0.12);

  // Radial displacement: breath + traveling wave + audio swell + noise.
  float polar = acos(clamp(a_dir.y, -1.0, 1.0));
  float radial = 1.0
    + u_breath
    + u_waveAmp * sin(u_wavePhase - polar * 3.2 + a_rand * 0.9)
    + u_audio * u_audioGain * (0.10 + 0.14 * sin(u_time * 9.0 + a_rand * 6.2831))
    + u_jitter * sin(u_time * (2.0 + a_rand * 3.0) + a_rand * 40.0);

  vec3 pos = dir * radial;

  // Project once to measure the on-screen distance to the cursor, then push
  // nearby particles outward along their normal (hover repel/scatter).
  float depth = CAM_DIST - pos.z;
  vec2 ndc = vec2(pos.x * FOV / depth / u_aspect, pos.y * FOV / depth);
  vec2 toMouse = vec2((ndc.x - u_mouse.x) * u_aspect, ndc.y - u_mouse.y);
  float repel = u_mouseActive * (1.0 - smoothstep(0.0, 0.5, length(toMouse)));
  repel *= repel;
  pos += dir * repel * 0.38;

  depth = CAM_DIST - pos.z;
  gl_Position = vec4(pos.x * FOV / depth / u_aspect, pos.y * FOV / depth, 0.0, 1.0);

  // Front hemisphere reads brighter for depth cueing.
  float facing = (dir.z + 1.0) * 0.5;
  v_alpha = (0.25 + 0.75 * facing * sqrt(facing)) * u_brightness * (1.0 + 0.3 * repel);
  v_color = a_color;
  gl_PointSize = a_size * u_dpr * (FOV / depth)
    * (1.0 + repel * 0.9 + u_audio * u_audioGain * 0.5);
}
`;

const FRAGMENT_SHADER = `
precision mediump float;

varying vec3 v_color;
varying float v_alpha;

void main() {
  float d = length(gl_PointCoord - 0.5);
  float a = smoothstep(0.5, 0.24, d);
  if (a < 0.01) discard;
  gl_FragColor = vec4(v_color, a * v_alpha);
}
`;

function compileProgram(gl: WebGLRenderingContext): WebGLProgram | null {
  const make = (type: number, source: string): WebGLShader | null => {
    const shader = gl.createShader(type);
    if (!shader) return null;
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
      console.error('[ParticleSphere] Shader compile failed:', gl.getShaderInfoLog(shader));
      gl.deleteShader(shader);
      return null;
    }
    return shader;
  };

  const vs = make(gl.VERTEX_SHADER, VERTEX_SHADER);
  const fs = make(gl.FRAGMENT_SHADER, FRAGMENT_SHADER);
  if (!vs || !fs) return null;

  const program = gl.createProgram();
  if (!program) return null;
  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    console.error('[ParticleSphere] Program link failed:', gl.getProgramInfoLog(program));
    gl.deleteProgram(program);
    return null;
  }
  return program;
}

/**
 * ParticleSphere — a WebGL point-cloud sphere in the style of jarvis.ceo.
 * Geometry is uploaded to the GPU once; each frame only updates uniforms, so
 * ~1200 particles animate at 60fps with near-zero CPU cost. Reacts to the
 * voice-chat mode (idle/listening/speaking/processing), swells with the live
 * mic level, and scatters away from the cursor on hover.
 */
export function ParticleSphere({
  mode,
  audioLevel = null,
  theme,
  particleCount = 1200,
  interactive = true,
  className,
  style,
  ...props
}: ParticleSphereProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const modeRef = useRef<SphereMode>(mode);
  const audioRef = useRef<number | null>(audioLevel);
  // Bumped when the WebGL context is restored so the effect rebuilds all GL
  // objects (the old program/buffers die with the lost context).
  const [contextGeneration, setContextGeneration] = useState(0);
  modeRef.current = mode;
  audioRef.current = audioLevel;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return undefined;

    const gl = canvas.getContext('webgl', {
      alpha: true,
      // Point sprites are edge-smoothed in the fragment shader; MSAA would
      // only add GPU cost here.
      antialias: false,
      premultipliedAlpha: false,
      powerPreference: 'high-performance',
    });
    if (!gl) {
      console.error('[ParticleSphere] WebGL unavailable; sphere not rendered.');
      return undefined;
    }

    const program = compileProgram(gl);
    if (!program) return undefined;
    gl.useProgram(program);

    const attrs = buildSphereAttributes(particleCount, theme);
    const buffers: WebGLBuffer[] = [];
    const bindAttribute = (name: string, data: Float32Array, size: number) => {
      const buffer = gl.createBuffer();
      if (!buffer) return;
      buffers.push(buffer);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
      const location = gl.getAttribLocation(program, name);
      gl.enableVertexAttribArray(location);
      gl.vertexAttribPointer(location, size, gl.FLOAT, false, 0, 0);
    };
    bindAttribute('a_dir', attrs.directions, 3);
    bindAttribute('a_rand', attrs.rands, 1);
    bindAttribute('a_size', attrs.sizes, 1);
    bindAttribute('a_color', attrs.colors, 3);

    const uniform = (name: string) => gl.getUniformLocation(program, name);
    const uTime = uniform('u_time');
    const uSpin = uniform('u_spin');
    const uSwirl = uniform('u_swirl');
    const uBreath = uniform('u_breath');
    const uJitter = uniform('u_jitter');
    const uWaveAmp = uniform('u_waveAmp');
    const uWavePhase = uniform('u_wavePhase');
    const uAudio = uniform('u_audio');
    const uAudioGain = uniform('u_audioGain');
    const uBrightness = uniform('u_brightness');
    const uAspect = uniform('u_aspect');
    const uDpr = uniform('u_dpr');
    const uMouse = uniform('u_mouse');
    const uMouseActive = uniform('u_mouseActive');

    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
    gl.clearColor(0, 0, 0, 0);

    let dpr = 1;
    let aspect = 1;
    const resize = () => {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      const { clientWidth: w, clientHeight: h } = canvas;
      canvas.width = Math.max(1, Math.round(w * dpr));
      canvas.height = Math.max(1, Math.round(h * dpr));
      aspect = h > 0 ? w / h : 1;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };

    // Animated state — kept in the closure and advanced each frame.
    let params = { ...SPHERE_MODE_PARAMS[modeRef.current] };
    let spinAngle = 0;
    let swirlAngle = 0;
    let wavePhase = 0;
    let audioSm = 0;
    let mouseX = 0;
    let mouseY = 0;
    let mouseActive = 0;
    let mouseTarget = 0;
    let raf = 0;
    let last = performance.now();
    let contextLost = false;

    const reducedMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

    const draw = (now: number) => {
      const dt = Math.min(0.05, Math.max(0.001, (now - last) / 1000));
      last = now;

      params = approachParams(params, SPHERE_MODE_PARAMS[modeRef.current], dt);
      spinAngle += params.spin * dt;
      swirlAngle += params.swirl * dt;
      wavePhase += params.waveHz * Math.PI * 2 * dt;
      audioSm = smoothAudioLevel(audioSm, audioRef.current ?? 0, dt);
      mouseActive += (mouseTarget - mouseActive) * (1 - Math.exp(-8 * dt));

      const t = now / 1000;
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.uniform1f(uTime, t);
      gl.uniform1f(uSpin, spinAngle);
      gl.uniform1f(uSwirl, swirlAngle);
      gl.uniform1f(uBreath, params.breathAmp * Math.sin(t * params.breathHz * Math.PI * 2));
      gl.uniform1f(uJitter, params.jitter);
      gl.uniform1f(uWaveAmp, params.waveAmp);
      gl.uniform1f(uWavePhase, wavePhase);
      gl.uniform1f(uAudio, audioSm);
      gl.uniform1f(uAudioGain, params.audioGain);
      gl.uniform1f(uBrightness, params.brightness);
      gl.uniform1f(uAspect, aspect);
      gl.uniform1f(uDpr, dpr);
      gl.uniform2f(uMouse, mouseX, mouseY);
      gl.uniform1f(uMouseActive, mouseActive);
      gl.drawArrays(gl.POINTS, 0, attrs.count);
    };

    const tick = (now: number) => {
      if (contextLost) return;
      draw(now);
      raf = requestAnimationFrame(tick);
    };

    resize();
    if (reducedMotion) {
      // Render a single static sphere; skip the animation loop entirely.
      draw(performance.now());
    } else {
      raf = requestAnimationFrame(tick);
    }

    const ro = new ResizeObserver(() => {
      resize();
      if (reducedMotion) draw(performance.now());
    });
    ro.observe(canvas);

    const onPointerMove = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      if (rect.width === 0 || rect.height === 0) return;
      mouseX = ((event.clientX - rect.left) / rect.width) * 2 - 1;
      mouseY = -(((event.clientY - rect.top) / rect.height) * 2 - 1);
      mouseTarget = 1;
    };
    const onPointerLeave = () => {
      mouseTarget = 0;
    };
    if (interactive && !reducedMotion) {
      canvas.addEventListener('pointermove', onPointerMove);
      canvas.addEventListener('pointerleave', onPointerLeave);
    }

    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(raf);
    };
    const onContextRestored = () => {
      // Buffers/programs are gone with the old context; rebuild everything.
      setContextGeneration(generation => generation + 1);
    };
    canvas.addEventListener('webglcontextlost', onContextLost);
    canvas.addEventListener('webglcontextrestored', onContextRestored);

    return () => {
      contextLost = true;
      cancelAnimationFrame(raf);
      ro.disconnect();
      canvas.removeEventListener('pointermove', onPointerMove);
      canvas.removeEventListener('pointerleave', onPointerLeave);
      canvas.removeEventListener('webglcontextlost', onContextLost);
      canvas.removeEventListener('webglcontextrestored', onContextRestored);
      buffers.forEach(buffer => gl.deleteBuffer(buffer));
      gl.deleteProgram(program);
    };
  }, [theme, particleCount, interactive, contextGeneration]);

  return (
    <canvas
      ref={canvasRef}
      className={cn(interactive ? 'cursor-default' : 'pointer-events-none', className)}
      style={{ width: '100%', height: '100%', display: 'block', ...style }}
      aria-hidden="true"
      {...props}
    />
  );
}
