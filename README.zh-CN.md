[English](README.md) | **中文**

---

# ViteCut

基于 Web 的视频/多媒体编辑器，采用 pnpm workspaces 的 Monorepo 结构。

## 功能概览

- **工程编辑**：导入视频创建工程，支持多轨道、多类型片段（视频、图片、文本、画布元素等）
- **预览播放**：与时间轴联动的实时预览，支持播放/暂停、跳转、画布背景色等
- **时间轴**：多轨道时间轴、片段拖拽与选中、缩略图展示
- **素材库**：视频、图片、文字、TTS、录音、画布、音频等面板，统一从侧边栏管理
- **媒体与导出**：基于 Mediabunny 的解析与 canvas 输出管线（由 `@vitecut/media` 等包提供）

## 项目结构

```
ViteCut/
├── packages/
│   ├── app/                      # React 前端应用（编辑器 UI）
│   │   └── src/
│   │       ├── editor/           # 编辑器布局、预览、时间轴、素材库
│   │       ├── stores/           # Zustand 状态（projectStore 等）
│   │       └── components/
│   └── @vitecut/
│       ├── project/              # 工程数据结构（Asset、Track、Clip 等）
│       ├── timeline/             # 时间轴数据与 React 封装
│       ├── canvas/               # 画布编辑与渲染
│       ├── media/                # 媒体解析与导出（Mediabunny 封装）
│       ├── audio/                # 音频相关
│       ├── renderer/             # 渲染相关
│       ├── record/               # 录制相关
│       └── utils/                # 通用工具（ID、时间等）
├── pnpm-workspace.yaml
└── package.json
```

## 在线 Demo

- **在线 Demo**：[https://www.vitecut.com](https://www.vitecut.com)

## 环境与依赖

- **Node.js**：建议 18+
- **包管理**：pnpm

安装依赖：

```bash
pnpm install
```

## 脚本说明

| 命令                  | 说明                                     |
| --------------------- | ---------------------------------------- |
| `pnpm dev`            | 启动应用开发服务器（默认带默认视频工程） |
| `pnpm build`          | 按依赖顺序构建所有包并构建 app           |
| `pnpm build:packages` | 仅构建所有 `@vitecut/*` 包               |
| `pnpm build:app`      | 仅构建 app（需先构建依赖包）             |
| `pnpm build:timeline` | 仅构建 @vitecut/timeline                 |
| `pnpm build:canvas`   | 仅构建 @vitecut/canvas                   |
| `pnpm lint`           | 全仓库 lint                              |
| `pnpm preview`        | 预览构建后的 app                         |
| `pnpm clean`          | 清理各包 dist 目录                       |

## 部署（GitHub Pages）

- **工作流**：每次推送到 `master` 分支时，`.github/workflows/deploy.yml` 会构建应用并部署到 GitHub Pages。
- **构建命令**：在设置 `GITHUB_PAGES=true` 的环境变量下执行 `pnpm build:app`，使 `vite.config.ts` 使用 `base: "/ViteCut/"`。
- **输出目录**：GitHub Pages 工作流会上传 `packages/app/dist` 目录作为站点产物。

本地模拟 GitHub Pages 构建方式：

```bash
GITHUB_PAGES=true pnpm build:app
```

## 技术栈

- **应用**：React 19、TypeScript、Vite
- **状态**：Zustand（单一 project 数据源 + 预览状态 currentTime / isPlaying / duration）
- **媒体**：Mediabunny（解析、编码）、Canvas API（预览与导出管线）
- **时间轴 UI**：@xzdarcy/react-timeline-editor

## 核心概念

- **Project**：工程根数据，包含画布尺寸、fps、资源池（assets）、轨道（tracks）及每条轨道上的片段（clips）。
- **Preview**：由 `currentTime` / `isPlaying` 驱动，在对应时间区间内渲染轨道上的视频、图片、文本、画布等元素。
- **Store**：`projectStore` 提供 `project`、`currentTime`、`duration`、`isPlaying`、`videoUrl`、`canvasBackgroundColor` 等，以及 `loadVideoFile`、时间/播放控制等动作。

## 包说明（简要）

- **app**：编辑器界面（Header、Library、Preview、Timeline），依赖各 `@vitecut/*` 包。
- **@vitecut/project**：工程、资源、轨道、片段的类型与数据结构。
- **@vitecut/timeline**：时间轴数据转换与 React 时间轴组件封装。
- **@vitecut/canvas**：画布编辑与输出相关逻辑。
- **@vitecut/media**：基于 Mediabunny 的媒体探测、输入与 canvas 视频输出。
- **@vitecut/utils**：ID 生成、时间等通用工具。

各包详细说明见对应包内 `README.md`（如有）。

## 开发提示

1. 修改 `@vitecut/*` 后若 app 未自动用上新构建，可先执行 `pnpm build:packages` 再 `pnpm dev`。
2. 工程为空时会自动加载默认视频并创建工程；主要状态与 API 见 `packages/app/src/stores/projectStore.types.ts`。

## License

见各包内声明（如 `packages/app/LICENSE`）。
