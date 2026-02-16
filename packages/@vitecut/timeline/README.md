# @vitecut/timeline

时间轴逻辑包 - 提供时间轴的核心数据结构与时间/像素转换工具。

## 职责

- 管理时间轴总时长与当前时间
- 控制时间轴缩放比例
- 在时间与像素位置之间进行转换（例如用于 UI 渲染）

## 使用

```typescript
import { Timeline } from "@vitecut/timeline";

const timeline = new Timeline(60); // 60 秒时长
timeline.seek(10); // 跳转到 10 秒
timeline.setZoom(2); // 放大一倍
```
