# @vitecut/media

基于 [Mediabunny](https://mediabunny.dev/) 的媒体编解码工具包，用于 ViteCut 的媒体解析与导出场景。

## 职责

- 封装 Mediabunny 的基础能力：
  - 从 URL / Blob 创建输入源
  - 解析媒体基础信息（时长、主视频轨、主音频轨）
  - 创建基于 canvas 的视频输出（编码管线的拼装）
- 不负责任何画布渲染逻辑（由 `@vitecut/canvas` 负责）
- 不关心时间线 / 轨道（由 `@vitecut/timeline` 负责）

## 使用示例

### 解析媒体信息

```ts
import { probeMedia } from '@vitecut/media';

const file = /* File from <input type="file"> */;

const info = await probeMedia({ type: 'blob', blob: file });
console.log(info.duration, info.video, info.audio);
```

### 为导出创建 Canvas 视频输出

```ts
import { createCanvasVideoOutput } from "@vitecut/media";

// 导出专用 canvas，结合 @vitecut/canvas 渲染每一帧
const canvas = document.createElement("canvas");

const { output } = await createCanvasVideoOutput({
  canvas,
  format: "mp4",
  codec: "av1",
});

await output.start();

// 在时间线循环中：
// 1. 使用 @vitecut/canvas 根据当前时间渲染一帧到 canvas
// 2. Mediabunny 会通过 CanvasSource 采集像素并编码

await output.finalize();
// @ts-expect-error Mediabunny 的 Output target 类型视版本而定，这里仅作示例
const { buffer } = output.target;
```
