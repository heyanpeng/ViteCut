[English](README.md) | **中文**

---

<p align="center">
  <img src="packages/app/src/assets/logo.png" alt="ViteCut" height="80" />
</p>

<p align="center">
  具备AI生成能力的Web视频编辑器
</p>

## 在线体验

- 体验地址：`https://www.vitecut.com`

## 主要功能

- 接入 AI 生成能力，支持图像/视频生成工作流
- 内置录制能力，支持屏幕、摄像头、音频与组合录制
- 多轨时间轴编辑，支持片段级编排与操作
- 支持视频、音频、图片、文本等常见元素素材的编辑与编排
- 基于 Canvas 渲染管线的实时预览
- 后端基于 FFmpeg 的导出/渲染流水线
- 基于 `@vitecut/*` 的模块化 Monorepo 架构，便于复用与扩展

## 谁适合用 ViteCut

- 需要构建 Web 端时间轴视频编辑器的团队
- 希望将 AI 生成素材与人工时间轴编辑结合的创作者
- 需要可复用编辑能力模块并集成到自有产品的开发者

## 截图

![ViteCut 编辑器截图 1](packages/app/src/assets/ScreenShot_2026-03-03_222103_332.png)

## 本地运行（2 步）

### 1）安装依赖

```bash
pnpm install
```

### 2）启动开发环境

```bash
pnpm dev
```

## 架构概览（包级）

- `packages/app`：React Web 编辑器主应用（UI 编排与交互组织）
- `packages/api`：后端服务（鉴权、媒体上传、AI 生成接入、基于 FFmpeg 的导出/渲染任务）
- `packages/@vitecut/project`：工程领域模型（`Project`、`Track`、`Clip`、`Asset`）
- `packages/@vitecut/timeline`：时间轴数据适配与 React 封装
- `packages/@vitecut/canvas`：Canvas 编辑与渲染管线
- `packages/@vitecut/media`：媒体解析、探测与处理能力
- `packages/@vitecut/audio`：音频相关处理工具
- `packages/@vitecut/record`：录制相关能力与 hooks
- `packages/@vitecut/history`：撤销/重做与命令栈抽象
- `packages/@vitecut/hotkeys`：快捷键与按键绑定工具
- `packages/@vitecut/storage`：存储抽象层（如 OSS 集成）
- `packages/@vitecut/utils`：跨包复用的通用工具函数

## Monorepo 结构

```text
ViteCut/
├── packages/
│   ├── app/
│   └── @vitecut/
│       ├── project/
│       ├── timeline/
│       ├── canvas/
│       ├── media/
│       ├── audio/
│       ├── renderer/
│       ├── record/
│       └── utils/
├── .gitea/workflows/
├── docker-compose.yml
├── pnpm-workspace.yaml
└── package.json
```

## 常用命令

| 命令                  | 说明                        |
| --------------------- | --------------------------- |
| `pnpm dev`            | 启动开发环境                |
| `pnpm build`          | 构建所有 workspace 包和 app |
| `pnpm build:packages` | 仅构建所有 `@vitecut/*` 包  |
| `pnpm build:app`      | 仅构建 app                  |
| `pnpm lint`           | 对整个仓库执行 lint         |
| `pnpm preview`        | 预览构建产物                |
| `pnpm clean`          | 清理生成的 `dist` 目录      |

## License

许可证请查看各包内声明（例如 `packages/app/LICENSE`）。
