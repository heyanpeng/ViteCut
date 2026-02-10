# @swiftav/canvas

基于 Konva.js 的画布工具包，用于 SwiftAV 的视频 / 图像 / 文字编辑场景。

## 职责

- 使用 Konva 管理画布、图层与图形元素
- 提供统一的画布工具类，封装常见操作：
  - 创建舞台与基础图层（背景层、视频占位层、前景图层、文字图层）
  - 添加 / 更新 / 移除图像与文本
  - 统一的坐标与缩放控制

## 使用示例

```ts
import { CanvasEditor } from '@swiftav/canvas';

const editor = new CanvasEditor({
  container: document.getElementById('canvas-root')!,
  width: 1280,
  height: 720,
});

// 添加一段文本
const textId = editor.addText({
  text: 'Hello SwiftAV',
  x: 100,
  y: 100,
  fontSize: 48,
  fill: '#ffffff',
});

// 更新文本位置
editor.updateText(textId, { x: 200, y: 120 });
```

