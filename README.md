**English** | [中文](README.zh-CN.md)

---

<p align="center">
  <img src="packages/app/src/assets/logo.png" alt="ViteCut" height="80" />
</p>

<p align="center">
  Web video editor with AI generation capabilities
</p>

## Online Demo

- Live site: `https://www.vitecut.com`

## Key Features

- AI generation integration for image/video creation workflows
- Built-in recording capabilities for screen, camera, audio, and combined capture
- Multi-track timeline editing with clip-level operations
- Supports common media elements including video, audio, image, and text
- Real-time preview based on canvas rendering
- Backend export pipeline powered by FFmpeg
- Modular monorepo architecture with reusable `@vitecut/*` packages

## Who Is ViteCut For

- Teams building browser-based video editors with timeline workflows
- Creators who want to combine AI-generated assets with manual timeline editing
- Developers who need reusable editing modules for custom product integration

## Screenshots

![ViteCut Editor Screenshot 1](packages/app/src/assets/ScreenShot_2026-03-03_222103_332.png)
![ViteCut Editor Screenshot 2](packages/app/src/assets/ScreenShot_2026-03-03_222154_214.png)
![ViteCut Editor Screenshot 3](packages/app/src/assets/ScreenShot_2026-03-03_222251_487.png)
![ViteCut Editor Screenshot 4](packages/app/src/assets/ScreenShot_2026-03-03_222308_661.png)
![ViteCut Editor Screenshot 5](packages/app/src/assets/ScreenShot_2026-03-03_222345_968.png)
![ViteCut Editor Screenshot 6](packages/app/src/assets/ScreenShot_2026-03-03_222428_998.png)
![ViteCut Editor Screenshot 7](packages/app/src/assets/ScreenShot_2026-03-03_222447_941.png)

## Quick Start (2 Steps)

### 1) Install dependencies

```bash
pnpm install
```

### 2) Start local development

```bash
pnpm dev
```

## Architecture Overview (Package Level)

- `packages/app`: Main React web editor (UI composition and interaction orchestration)
- `packages/api`: Backend services (auth, media upload, AI generation integration, and FFmpeg-based export/render tasks)
- `packages/@vitecut/project`: Project domain model (`Project`, `Track`, `Clip`, `Asset`)
- `packages/@vitecut/timeline`: Timeline data adapter and React timeline wrapper
- `packages/@vitecut/canvas`: Canvas editing and rendering pipeline
- `packages/@vitecut/media`: Media parsing, probing, and processing helpers
- `packages/@vitecut/audio`: Audio-related processing utilities
- `packages/@vitecut/record`: Recording-related capabilities and hooks
- `packages/@vitecut/history`: Undo/redo history and command stack abstractions
- `packages/@vitecut/hotkeys`: Keyboard shortcut and keybinding utilities
- `packages/@vitecut/storage`: Storage abstraction layer (e.g. OSS integration)
- `packages/@vitecut/utils`: Shared cross-package utility functions

## Monorepo Layout

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

## Common Commands

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `pnpm dev`            | Start development server             |
| `pnpm build`          | Build all workspace packages and app |
| `pnpm build:packages` | Build all `@vitecut/*` packages only |
| `pnpm build:app`      | Build app only                       |
| `pnpm lint`           | Lint entire repository               |
| `pnpm preview`        | Preview built app                    |
| `pnpm clean`          | Remove generated `dist` folders      |

## License

See license files in each package (for example `packages/app/LICENSE`).
