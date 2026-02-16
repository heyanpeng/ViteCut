# @vitecut/canvas

基于 Konva.js 的画布工具包，用于 ViteCut 的视频 / 图像 / 文字编辑场景。

## 职责

- 使用 Konva 管理画布、图层与图形元素
- 提供统一的画布工具类，封装常见操作：
  - 创建舞台与基础图层（背景层 + 元素层）
  - 添加 / 更新 / 移除文本、图片、视频元素
  - 支持基于时间线的批量同步（`syncElements`）

## 使用示例

```ts
import { CanvasEditor, type RenderElement } from "@vitecut/canvas";

const editor = new CanvasEditor({
  container: document.getElementById("canvas-root")!,
  width: 1280,
  height: 720,
});

// 基于时间线计算当前时刻的渲染元素
const elements: RenderElement[] = [
  {
    id: "title",
    kind: "text",
    zIndex: 10,
    x: 100,
    y: 100,
    text: "Hello ViteCut",
    fontSize: 48,
    fill: "#ffffff",
  },
];

// 一次性同步到画布
editor.syncElements(elements);
```
