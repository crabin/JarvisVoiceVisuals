# 粒子星球效果组件

## 组件定位

`ParticleSphere` 是一个 WebGL 粒子球组件，用于表达语音交互中的等待、聆听、回答、思考四类状态。它本身只负责视觉渲染，不直接采集麦克风，也不管理业务状态。

源码位置：

- `src/particle-sphere.tsx`：React 组件与 WebGL 渲染循环
- `src/particle-sphere-core.ts`：状态参数、粒子分布、音频平滑等纯逻辑

## 组件 API

```tsx
<ParticleSphere
  mode="listening"
  audioLevel={0.45}
  theme="light"
  particleCount={1200}
  interactive
/>
```

| 属性 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `mode` | `'idle' \| 'listening' \| 'speaking' \| 'processing'` | 必填 | 当前语音状态，决定旋转、呼吸、波纹、湍流等动效参数 |
| `audioLevel` | `number \| null` | `null` | 麦克风或模拟音量，建议范围 `0-1`；主要在 `listening` 下使用 |
| `theme` | `'light' \| 'dark'` | 必填 | 选择亮色或暗色粒子调色板 |
| `particleCount` | `number` | `1200` | 粒子数量，数量越大越细腻，也越占 GPU |
| `interactive` | `boolean` | `true` | 是否启用鼠标悬停排斥效果 |
| `className` / `style` | React canvas 属性 | - | 透传到 `<canvas>` |

## 状态效果

| 状态 | 视觉表现 | 核心参数倾向 |
| --- | --- | --- |
| `idle` 等待 | 慢速漂移、轻微呼吸、亮度收敛 | 低 `spin`、低 `breathAmp`、无音频响应 |
| `listening` 聆听 | 随音量膨胀和轻微震动，带小幅波纹 | 开启 `audioGain`，中等 `spin` / `swirl` |
| `speaking` 回答 | 球面出现节奏性流动波纹 | 高 `waveAmp` / `waveHz` |
| `processing` 思考 | 粒子快速搅动、脉冲更明显 | 高 `spin`、高 `swirl`、高 `jitter` |

这些参数集中在 `SPHERE_MODE_PARAMS` 中，组件每帧通过 `approachParams` 平滑靠近目标状态，因此切换状态时不会突变。

## 内部机制

1. `buildSphereAttributes` 使用 Fibonacci golden-angle spiral 把粒子均匀分布到单位球面。
2. 每个粒子拥有稳定的方向、随机种子、点大小和颜色，避免组件重挂载后视觉随机漂移。
3. `requestAnimationFrame` 驱动渲染循环，并按帧更新时间、旋转、波纹相位、音频平滑值和鼠标影响值。
4. WebGL vertex shader 根据当前状态参数计算粒子的球面扰动；fragment shader 负责把点精灵渲染成柔和圆点。
5. 组件监听 `ResizeObserver`，按容器尺寸和 DPR 自适应 canvas 分辨率。
6. 用户开启 `prefers-reduced-motion: reduce` 时，只绘制静态帧，不启动连续动画。

## 接入示例

```tsx
import { ParticleSphere } from './particle-sphere';
import type { SphereMode, SphereTheme } from './particle-sphere-core';

function VoiceOrb({
  mode,
  audioLevel,
  theme,
}: {
  mode: SphereMode;
  audioLevel: number;
  theme: SphereTheme;
}) {
  return (
    <div style={{ width: 520, height: 520 }}>
      <ParticleSphere
        mode={mode}
        audioLevel={mode === 'listening' ? audioLevel : null}
        theme={theme}
      />
    </div>
  );
}
```

## 调参入口

常用调整点：

- 粒子密度：调整 `particleCount`
- 状态动效：调整 `SPHERE_MODE_PARAMS`
- 主题颜色：调整 `SPHERE_PALETTES`
- 音量跟随手感：调整 `smoothAudioLevel` 中 attack / release 速率
- 鼠标排斥强度：调整 shader 中 mouse 相关位移计算

## 注意事项

- 组件依赖浏览器 WebGL；WebGL 不可用时会打印错误并跳过渲染。
- 推荐外层容器提供明确宽高，组件 canvas 会填满父容器。
- `audioLevel` 应由业务层归一化到 `0-1`，避免视觉响应过激。
- 如果用于列表或多实例场景，优先降低 `particleCount`，避免多 canvas 同时占用 GPU。
