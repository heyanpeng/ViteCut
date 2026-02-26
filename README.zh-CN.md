[English](README.md) | **中文**

---

<p align="center">
  <img src="packages/app/src/assets/logo.png" alt="ViteCut" height="80" />
</p>

<p align="center">
  基于 Web 的视频 / 多媒体非线性编辑器，采用 pnpm workspaces 的 Monorepo 结构。
</p>

### ViteCut 是什么？

ViteCut 是一个运行在浏览器里的 **非线性剪辑（NLE）工具**，主要特点：

- **多轨时间轴编辑**：支持视频、图片、文字、音频、画布元素等多种片段
- **高质量预览**：基于 Canvas 的渲染管线，预览与导出效果一致
- **可复用的包体系**：核心能力拆分在 `@vitecut/*` 包中，可以在其他前端项目中复用

整个编辑流程在浏览器本地完成，无需安装客户端或依赖后端服务。

### 在线 Demo

- **在线地址**：`https://www.vitecut.com`

---

## 功能概览

- **工程与时间轴**
  - 多轨道时间轴，支持拖拽、裁剪、选中、复制、删除
  - 片段类型包括：视频、图片、文字、音频、画布元素等
  - 轨道静音、轨道排序调整
- **预览**
  - 与时间轴联动的实时预览
  - 基于 Canvas 的渲染器，保证输出一致性
  - 支持画布尺寸预设与背景色设置
- **素材库**
  - 视频、图片、文字、TTS、录音、画布、音频等面板
  - 通过侧边栏统一管理工程中的资源
- **媒体与导出**
  - 基于 `@vitecut/media`（封装 Mediabunny）进行媒体解析与解码
  - 提供可复用的 Canvas 输出管线，便于集成到其他应用

---

## Monorepo 结构

```text
ViteCut/
├── packages/
│   ├── app/                      # React 前端应用（编辑器 UI）
│   │   └── src/
│   │       ├── editor/           # 编辑器布局、预览、时间轴、素材库
│   │       ├── stores/           # Zustand 状态（projectStore 等）
│   │       └── components/       # 通用 UI 组件
│   └── @vitecut/
│       ├── project/              # 工程数据结构（Asset、Track、Clip 等）
│       ├── timeline/             # 时间轴数据与 React 封装
│       ├── canvas/               # 画布编辑与渲染
│       ├── media/                # 媒体解析与导出（基于 Mediabunny）
│       ├── audio/                # 音频相关工具
│       ├── renderer/             # 渲染相关工具
│       ├── record/               # 录制相关工具
│       └── utils/                # 通用工具（ID、时间等）
├── pnpm-workspace.yaml
└── package.json
```

每个 `@vitecut/*` 包都尽量保持独立，可单独被其他项目引用（详见各包内 `README.md`）。

---

## 环境与依赖

- **Node.js**：建议 18+
- **包管理器**：pnpm

安装依赖：

```bash
pnpm install
```

在仓库根目录启动开发环境：

```bash
pnpm dev
```

编辑器 UI 由 `packages/app` 提供，会在浏览器中打开。

---

## 构建与脚本

在仓库根目录常用脚本如下：

| 命令                  | 说明                             |
| --------------------- | -------------------------------- |
| `pnpm dev`            | 启动开发服务器（按需构建依赖包） |
| `pnpm build`          | 按依赖顺序构建所有包并构建 app   |
| `pnpm build:packages` | 仅构建所有 `@vitecut/*` 包       |
| `pnpm build:app`      | 仅构建 app（默认依赖包已构建好） |
| `pnpm build:timeline` | 仅构建 `@vitecut/timeline`       |
| `pnpm build:canvas`   | 仅构建 `@vitecut/canvas`         |
| `pnpm lint`           | 对整个仓库进行 lint              |
| `pnpm preview`        | 预览构建后的 app                 |
| `pnpm clean`          | 清理所有 `dist` 目录             |

---

## 技术栈

- **应用层**：React 19、TypeScript、Vite
- **状态管理**：Zustand（单一 project 数据源 + 预览状态 `currentTime` / `isPlaying` / `duration`）
- **媒体处理**：Mediabunny + Canvas API
- **时间轴 UI**：`@xzdarcy/react-timeline-editor`，由 `@vitecut/timeline` 进行二次封装

---

## 架构概览

- **工程模型（`@vitecut/project`）**
  - 定义 `Project`、`Asset`、`Track`、`Clip` 等核心数据结构
  - 时间轴与预览都基于该模型派生各自视图
- **时间轴（`@vitecut/timeline`）**
  - 将工程数据转换为 `react-timeline-editor` 所需的数据结构
  - 提供 `ReactTimeline` 封装组件，增加一些额外能力（如轨道前缀列）
- **预览（`@vitecut/canvas` + `@vitecut/media`）**
  - 使用 Canvas 编辑器 / 渲染器绘制视频、图片、文字、画布等元素
  - 由 `currentTime` 和 `isPlaying` 驱动可见元素同步
- **应用层（`packages/app`）**
  - 负责整体编辑器布局（Header、Library、Preview、Timeline）
  - 通过 `projectStore`（Zustand）统一管理工程与播放状态

更多实现细节可直接查看 `packages/app/src/editor` 下的源码与各包内的 `README.md`。

---

## 开发提示

- 修改 `@vitecut/*` 后若 app 未自动用上新构建，可先执行 `pnpm build:packages` 再 `pnpm dev`。
- 工程为空时可以自动加载默认视频并创建工程；主要状态与 API 见 `packages/app/src/stores/projectStore.types.ts`。

---

## License

License 见各包内声明（如 `packages/app/LICENSE`）；第三方依赖遵循各自的开源协议。
