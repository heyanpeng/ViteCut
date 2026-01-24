# @swiftav/core

核心引擎层 - WebCodecs 和 CanvasKit 的基础封装

## 职责

- WebCodecs API 封装（VideoDecoder、VideoEncoder、AudioDecoder、AudioEncoder）
- CanvasKit 初始化与基础操作
- 媒体资源加载（视频、音频文件）
- 容器格式解析（MP4 解析，基于 mp4box.js）
- 基础工具函数（时间转换、格式转换等）
- 错误处理与日志

## 使用

```typescript
import { VideoDecoder, CanvasKitManager, MP4Parser } from '@swiftav/core';
```
