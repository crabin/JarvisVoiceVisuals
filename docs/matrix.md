# 点阵效果组件

## 组件定位

`Matrix` 是一个 SVG 圆点矩阵组件，用于表达语音状态、加载态、波形和 VU 音量柱。当前演示页通过 `MatrixStage` 把它包装成与粒子星球一致的四状态语音视觉。

源码位置：

- `src/matrix.tsx`：点阵组件、动画帧播放器、帧生成器
- `src/main.tsx`：`MatrixStage` 状态适配层

## 组件 API

```tsx
<Matrix
  rows={17}
  cols={17}
  mode="default"
  frames={frames}
  fps={16}
  size={18}
  gap={10}
  brightness={0.9}
  palette={{
    on: 'rgba(24, 24, 24, 0.96)',
    off: 'rgba(148, 156, 165, 0.4)',
  }}
/>
```

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `rows` | `number` | 必填 | 点阵行数 |
| `cols` | `number` | 必填 | 点阵列数 |
| `pattern` | `Frame` | - | 静态帧；传入后优先于 `frames` |
| `frames` | `Frame[]` | - | 动画帧序列 |
| `fps` | `number` | `12` | 动画播放帧率 |
| `autoplay` | `boolean` | `true` | 是否自动播放动画 |
| `loop` | `boolean` | `true` | 是否循环播放 |
| `mode` | `'default' \| 'vu'` | `'default'` | 默认帧动画或 VU 音量柱模式 |
| `levels` | `number[]` | - | VU 模式下每列音量，建议范围 `0-1` |
| `size` | `number` | `10` | 单个圆点直径 |
| `gap` | `number` | `2` | 圆点间距 |
| `palette` | `{ on: string; off: string }` | currentColor / 灰色 | 亮点和暗点颜色 |
| `brightness` | `number` | `1` | 整体亮度倍率 |
| `ariaLabel` | `string` | `'matrix display'` | 可访问性标签 |
| `onFrame` | `(index: number) => void` | - | 帧切换回调 |
| `columnGaps` | `Record<number, number>` | - | 指定列后追加额外间距 |

`Frame` 类型是二维数字矩阵：

```ts
type Frame = number[][];
```

每个数值通常为 `0-1`，表示对应圆点的亮度。

## 四状态适配

演示页中的 `MatrixStage` 使用 17 x 17 点阵，并把语音状态映射为不同帧源：

| 状态 | 点阵模式 | 帧源 / 数据源 | 视觉表现 |
| --- | --- | --- | --- |
| `idle` 等待 | `default` | `createPulseFrames(17)` | 中心向外扩散的呼吸脉冲 |
| `listening` 聆听 | `vu` | `createVuLevels(phase, audio)` | 随音量变化的多列 VU 柱 |
| `speaking` 回答 | `default` | `createWaveFrames(17, 17)` | 横向声波起伏 |
| `processing` 思考 | `default` | `createRadialWaveFrames(17)` | 径向同心波纹 |

状态相关亮度和帧率集中在 `MATRIX_MOTION` 中。

## 内部机制

1. `useAnimation` 使用 `requestAnimationFrame` 按指定 `fps` 推进 `frameIndex`。
2. `Matrix` 根据优先级选择当前画面：`vu + levels`、`pattern`、`frames[frameIndex]`、空帧。
3. `ensureFrameSize` 会把输入帧补齐或裁剪到指定行列，降低调用方维护成本。
4. SVG 中每个圆点由底层暗点、亮点和 glow 叠加构成，亮度来自当前帧的单元格值。
5. `size`、`gap`、`columnGaps` 会共同计算 SVG viewBox，确保点阵布局稳定。

## 接入示例

```tsx
import {
  createPulseFrames,
  createRadialWaveFrames,
  createWaveFrames,
  Matrix,
} from './matrix';
import type { SphereMode, SphereTheme } from './particle-sphere-core';

const ROWS = 17;
const COLS = 17;

const framesByMode = {
  idle: createPulseFrames(ROWS),
  speaking: createWaveFrames(ROWS, COLS),
  processing: createRadialWaveFrames(ROWS),
};

function VoiceMatrix({
  mode,
  levels,
}: {
  mode: SphereMode;
  theme: SphereTheme;
  levels: number[];
}) {
  const isListening = mode === 'listening';

  return (
    <Matrix
      rows={ROWS}
      cols={COLS}
      mode={isListening ? 'vu' : 'default'}
      levels={isListening ? levels : undefined}
      frames={isListening ? undefined : framesByMode[mode] ?? framesByMode.idle}
      fps={isListening ? 18 : 16}
      size={18}
      gap={10}
      brightness={0.9}
      ariaLabel={mode}
    />
  );
}
```

## 调参入口

常用调整点：

- 点阵密度：调整 `rows` / `cols`
- 点大小与间距：调整 `size` / `gap`
- 动画速度：调整 `fps`
- 等待态形态：调整 `createPulseFrames`
- 回答态波形：调整 `createWaveFrames`
- 思考态波纹：调整 `createRadialWaveFrames`
- 聆听态音量曲线：调整业务层传入的 `levels` 或演示页 `createVuLevels`

## 注意事项

- `pattern` 会覆盖 `frames` 播放，适合静态图标或固定帧。
- VU 模式需要传入 `levels`；数组长度不足时只渲染已有列，剩余列为空。
- 每个点是 SVG 元素，超大行列数会增加 DOM 成本。
- 组件本身不处理麦克风采集，只消费已归一化的音量列数据。
