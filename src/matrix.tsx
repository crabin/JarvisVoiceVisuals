import * as React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';

export type Frame = number[][];
type MatrixMode = 'default' | 'vu';

interface CellPosition {
  x: number;
  y: number;
}

interface MatrixProps extends React.HTMLAttributes<HTMLDivElement> {
  rows: number;
  cols: number;
  pattern?: Frame;
  frames?: Frame[];
  fps?: number;
  autoplay?: boolean;
  loop?: boolean;
  size?: number;
  gap?: number;
  palette?: {
    on: string;
    off: string;
  };
  brightness?: number;
  ariaLabel?: string;
  onFrame?: (index: number) => void;
  mode?: MatrixMode;
  levels?: number[];
  columnGaps?: Record<number, number>;
}

function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

function clamp(value: number): number {
  return Math.max(0, Math.min(1, value));
}

function ensureFrameSize(frame: Frame, rows: number, cols: number): Frame {
  const result: Frame = [];
  for (let r = 0; r < rows; r += 1) {
    const row = frame[r] || [];
    result.push([]);
    for (let c = 0; c < cols; c += 1) {
      result[r][c] = row[c] ?? 0;
    }
  }
  return result;
}

function useAnimation(
  frames: Frame[] | undefined,
  options: {
    fps: number;
    autoplay: boolean;
    loop: boolean;
    onFrame?: (index: number) => void;
  }
): { frameIndex: number; isPlaying: boolean } {
  const [frameIndex, setFrameIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(options.autoplay);
  const frameIdRef = useRef<number | undefined>(undefined);
  const lastTimeRef = useRef<number>(0);
  const accumulatorRef = useRef<number>(0);

  useEffect(() => {
    if (!frames || frames.length === 0 || !isPlaying) {
      return undefined;
    }

    const frameInterval = 1000 / options.fps;

    const animate = (currentTime: number) => {
      if (lastTimeRef.current === 0) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = currentTime - lastTimeRef.current;
      lastTimeRef.current = currentTime;
      accumulatorRef.current += deltaTime;

      if (accumulatorRef.current >= frameInterval) {
        accumulatorRef.current -= frameInterval;

        setFrameIndex(prev => {
          const next = prev + 1;
          if (next >= frames.length) {
            if (options.loop) {
              options.onFrame?.(0);
              return 0;
            }

            setIsPlaying(false);
            return prev;
          }

          options.onFrame?.(next);
          return next;
        });
      }

      frameIdRef.current = requestAnimationFrame(animate);
    };

    frameIdRef.current = requestAnimationFrame(animate);

    return () => {
      if (frameIdRef.current) {
        cancelAnimationFrame(frameIdRef.current);
      }
    };
  }, [frames, isPlaying, options.fps, options.loop, options.onFrame]);

  useEffect(() => {
    setFrameIndex(0);
    setIsPlaying(options.autoplay);
    lastTimeRef.current = 0;
    accumulatorRef.current = 0;
  }, [frames, options.autoplay]);

  return { frameIndex, isPlaying };
}

function emptyFrame(rows: number, cols: number): Frame {
  return Array.from({ length: rows }, () => Array(cols).fill(0));
}

function setPixel(frame: Frame, row: number, col: number, value: number): void {
  if (row >= 0 && row < frame.length && col >= 0 && col < frame[0].length) {
    frame[row][col] = value;
  }
}

export const digits: Frame[] = [
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 0, 1, 0, 0],
    [0, 1, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [1, 1, 1, 1, 1],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 0, 0, 1, 0],
    [0, 0, 1, 1, 0],
    [0, 1, 0, 1, 0],
    [1, 0, 0, 1, 0],
    [1, 1, 1, 1, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 0, 1, 0],
  ],
  [
    [1, 1, 1, 1, 1],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 0],
    [1, 0, 0, 0, 0],
    [1, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [1, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 1, 0],
    [0, 0, 1, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
    [0, 1, 0, 0, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
  [
    [0, 1, 1, 1, 0],
    [1, 0, 0, 0, 1],
    [1, 0, 0, 0, 1],
    [0, 1, 1, 1, 1],
    [0, 0, 0, 0, 1],
    [0, 0, 0, 0, 1],
    [0, 1, 1, 1, 0],
  ],
];

export const chevronLeft: Frame = [
  [0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
];

export const chevronRight: Frame = [
  [0, 1, 0, 0, 0],
  [0, 0, 1, 0, 0],
  [0, 0, 0, 1, 0],
  [0, 0, 1, 0, 0],
  [0, 1, 0, 0, 0],
];

export function createLoaderFrames(size = 7): Frame[] {
  const frames: Frame[] = [];
  const center = (size - 1) / 2;
  const radius = center - 0.5;
  const frameCount = 12;
  const dotCount = Math.max(8, Math.round(radius * Math.PI));

  for (let frame = 0; frame < frameCount; frame += 1) {
    const f = emptyFrame(size, size);
    for (let i = 0; i < dotCount; i += 1) {
      const angle = (frame / frameCount) * Math.PI * 2 + (i / dotCount) * Math.PI * 2;
      const x = Math.round(center + Math.cos(angle) * radius);
      const y = Math.round(center + Math.sin(angle) * radius);
      const value = 1 - i / (dotCount * 1.25);
      setPixel(f, y, x, Math.max(0.2, value));
    }
    frames.push(f);
  }

  return frames;
}

export const loader: Frame[] = createLoaderFrames();

export function createPulseFrames(size = 7): Frame[] {
  const frames: Frame[] = [];
  const center = Math.floor((size - 1) / 2);
  const maxRadius = Math.max(1, Math.floor(size / 2));
  const frameCount = 16;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const f = emptyFrame(size, size);
    const progress = frame / frameCount;

    setPixel(f, center, center, 1);

    // Expanding ripple: the ring grows from the center to the edge while
    // fading, but stays visible for the whole cycle.
    const radius = 1 + progress * (maxRadius - 1);
    const value = 0.2 + 0.65 * (1 - progress);
    for (let dy = -maxRadius; dy <= maxRadius; dy += 1) {
      for (let dx = -maxRadius; dx <= maxRadius; dx += 1) {
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (Math.abs(dist - radius) < 0.7) {
          setPixel(f, center + dy, center + dx, value);
        }
      }
    }

    frames.push(f);
  }

  return frames;
}

export const pulse: Frame[] = createPulseFrames();

export function createRadialWaveFrames(size = 7, frameCount = 24): Frame[] {
  const frames: Frame[] = [];
  const center = (size - 1) / 2;
  const maxDist = Math.sqrt(2) * center;
  const wavelength = maxDist / 1.5;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const phase = (frame / frameCount) * Math.PI * 2;
    const f = emptyFrame(size, size);

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        const dist = Math.sqrt((x - center) ** 2 + (y - center) ** 2);
        // Outward-travelling circular wave; every cell stays lit at a
        // varying level so the whole grid reads as concentric ripples.
        const wave = Math.sin((dist / wavelength) * Math.PI * 2 - phase);
        f[y][x] = 0.08 + ((wave + 1) / 2) * 0.88;
      }
    }

    frames.push(f);
  }

  return frames;
}

export function vu(columns: number, levels: number[], rows = 7): Frame {
  const frame = emptyFrame(rows, columns);

  for (let col = 0; col < Math.min(columns, levels.length); col += 1) {
    const level = Math.max(0, Math.min(1, levels[col]));
    const height = Math.floor(level * rows);

    for (let row = 0; row < rows; row += 1) {
      const rowFromBottom = rows - 1 - row;
      if (rowFromBottom < height) {
        let value = 1;
        if (row < rows * 0.3) {
          value = 1;
        } else if (row < rows * 0.6) {
          value = 0.8;
        } else {
          value = 0.6;
        }
        frame[row][col] = value;
      }
    }
  }

  return frame;
}

export function createWaveFrames(rows = 7, cols = 7): Frame[] {
  const frames: Frame[] = [];
  const frameCount = 24;
  const amplitude = (rows - 2) / 2;
  const midline = (rows - 1) / 2;

  for (let frame = 0; frame < frameCount; frame += 1) {
    const f = emptyFrame(rows, cols);
    const phase = (frame / frameCount) * Math.PI * 2;

    for (let col = 0; col < cols; col += 1) {
      const colPhase = (col / cols) * Math.PI * 2;
      const height = Math.sin(phase + colPhase) * amplitude + midline;
      const row = Math.floor(height);

      if (row >= 0 && row < rows) {
        setPixel(f, row, col, 1);
        const frac = height - row;
        if (row > 0) setPixel(f, row - 1, col, 1 - frac);
        if (row < rows - 1) setPixel(f, row + 1, col, frac);
      }
    }

    frames.push(f);
  }

  return frames;
}

export const wave: Frame[] = createWaveFrames();

export const snake: Frame[] = (() => {
  const frames: Frame[] = [];
  const rows = 7;
  const cols = 7;
  const path: Array<[number, number]> = [];

  let x = 0;
  let y = 0;
  let dx = 1;
  let dy = 0;

  const visited = new Set<string>();
  while (path.length < rows * cols) {
    path.push([y, x]);
    visited.add(`${y},${x}`);

    const nextX = x + dx;
    const nextY = y + dy;

    if (
      nextX >= 0 &&
      nextX < cols &&
      nextY >= 0 &&
      nextY < rows &&
      !visited.has(`${nextY},${nextX}`)
    ) {
      x = nextX;
      y = nextY;
    } else {
      const newDx = -dy;
      const newDy = dx;
      dx = newDx;
      dy = newDy;

      const turnedX = x + dx;
      const turnedY = y + dy;

      if (
        turnedX >= 0 &&
        turnedX < cols &&
        turnedY >= 0 &&
        turnedY < rows &&
        !visited.has(`${turnedY},${turnedX}`)
      ) {
        x = turnedX;
        y = turnedY;
      } else {
        break;
      }
    }
  }

  const snakeLength = 5;
  for (let frame = 0; frame < path.length; frame += 1) {
    const f = emptyFrame(rows, cols);

    for (let i = 0; i < snakeLength; i += 1) {
      const idx = frame - i;
      if (idx >= 0 && idx < path.length) {
        const [pathY, pathX] = path[idx];
        const value = 1 - i / snakeLength;
        setPixel(f, pathY, pathX, value);
      }
    }

    frames.push(f);
  }

  return frames;
})();

export const Matrix = React.forwardRef<HTMLDivElement, MatrixProps>(
  (
    {
      rows,
      cols,
      pattern,
      frames,
      fps = 12,
      autoplay = true,
      loop = true,
      size = 10,
      gap = 2,
      palette = {
        on: 'currentColor',
        off: 'rgba(148, 163, 184, 0.18)',
      },
      brightness = 1,
      ariaLabel,
      onFrame,
      mode = 'default',
      levels,
      columnGaps,
      className,
      ...props
    },
    ref
  ) => {
    const { frameIndex } = useAnimation(frames, {
      fps,
      autoplay: autoplay && !pattern,
      loop,
      onFrame,
    });

    const gradientId = React.useId().replace(/:/g, '');
    const onGradientId = `${gradientId}-matrix-pixel-on`;
    const offGradientId = `${gradientId}-matrix-pixel-off`;
    const glowId = `${gradientId}-matrix-glow`;

    const currentFrame = useMemo(() => {
      if (mode === 'vu' && levels && levels.length > 0) {
        return ensureFrameSize(vu(cols, levels, rows), rows, cols);
      }

      if (pattern) {
        return ensureFrameSize(pattern, rows, cols);
      }

      if (frames && frames.length > 0) {
        return ensureFrameSize(frames[frameIndex] || frames[0], rows, cols);
      }

      return ensureFrameSize([], rows, cols);
    }, [pattern, frames, frameIndex, rows, cols, mode, levels]);

    const cellPositions = useMemo(() => {
      const positions: CellPosition[][] = [];

      for (let row = 0; row < rows; row += 1) {
        positions[row] = [];
        let x = 0;
        for (let col = 0; col < cols; col += 1) {
          positions[row][col] = {
            x,
            y: row * (size + gap),
          };
          x += size + gap + (columnGaps?.[col] ?? 0);
        }
      }

      return positions;
    }, [rows, cols, size, gap, columnGaps]);

    const svgDimensions = useMemo(() => {
      const extraColumnGaps = Object.entries(columnGaps ?? {}).reduce((total, [col, extraGap]) => {
        const column = Number(col);
        return Number.isInteger(column) && column >= 0 && column < cols - 1
          ? total + extraGap
          : total;
      }, 0);

      return {
        width: cols * (size + gap) - gap + extraColumnGaps,
        height: rows * (size + gap) - gap,
      };
    }, [rows, cols, size, gap, columnGaps]);

    const isAnimating = !pattern && frames && frames.length > 0;

    return (
      <div
        ref={ref}
        role="img"
        aria-label={ariaLabel ?? 'matrix display'}
        aria-live={isAnimating ? 'polite' : undefined}
        className={cn('relative inline-block', className)}
        style={
          {
            '--matrix-on': palette.on,
            '--matrix-off': palette.off,
            '--matrix-gap': `${gap}px`,
            '--matrix-size': `${size}px`,
          } as React.CSSProperties
        }
        {...props}
      >
        <svg
          width={svgDimensions.width}
          height={svgDimensions.height}
          viewBox={`0 0 ${svgDimensions.width} ${svgDimensions.height}`}
          xmlns="http://www.w3.org/2000/svg"
          className="block"
          style={{ overflow: 'visible' }}
        >
          <defs>
            <radialGradient id={onGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--matrix-on)" stopOpacity="1" />
              <stop offset="70%" stopColor="var(--matrix-on)" stopOpacity="0.85" />
              <stop offset="100%" stopColor="var(--matrix-on)" stopOpacity="0.6" />
            </radialGradient>

            <radialGradient id={offGradientId} cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="var(--matrix-off)" stopOpacity="1" />
              <stop offset="100%" stopColor="var(--matrix-off)" stopOpacity="0.7" />
            </radialGradient>

            <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="1.15" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>
          </defs>

          <style>
            {`
              .matrix-pixel,
              .matrix-pixel-glow {
                transform-box: fill-box;
                transform-origin: center;
              }

              .matrix-pixel {
                transition: opacity 320ms ease-out, transform 220ms ease-out;
                transform-origin: center;
              }

              .matrix-pixel-glow {
                pointer-events: none;
                transition: opacity 420ms ease-out, transform 260ms ease-out;
              }
            `}
          </style>

          {currentFrame.map((row, rowIndex) =>
            row.map((value, colIndex) => {
              const pos = cellPositions[rowIndex]?.[colIndex];
              if (!pos) return null;

              const opacity = clamp(brightness * value);
              const isActive = opacity > 0.52;
              const isOn = opacity > 0.04;
              const fill = isOn ? `url(#${onGradientId})` : `url(#${offGradientId})`;

              const scale = 0.9 + opacity * 0.12;
              const radius = (size / 2) * 0.82;
              const cellOpacity = isOn
                ? 0.14 + opacity * 0.72
                : 0.07;
              const glowOpacity = isActive ? opacity * 0.11 : 0;

              return (
                <g key={`${rowIndex}-${colIndex}`}>
                  {isActive && (
                    <circle
                      className="matrix-pixel-glow"
                      cx={pos.x + size / 2}
                      cy={pos.y + size / 2}
                      r={radius * 1.55}
                      fill="var(--matrix-on)"
                      filter={`url(#${glowId})`}
                      opacity={glowOpacity}
                      style={{
                        transform: `scale(${scale})`,
                      }}
                    />
                  )}
                  <circle
                    className="matrix-pixel"
                    cx={pos.x + size / 2}
                    cy={pos.y + size / 2}
                    r={radius}
                    fill={fill}
                    opacity={cellOpacity}
                    style={{
                      transform: `scale(${scale})`,
                    }}
                  />
                </g>
              );
            })
          )}
        </svg>
      </div>
    );
  }
);

Matrix.displayName = 'Matrix';
