**English** | [中文](README.zh-CN.md)

---

# ViteCut

Web-based video/multimedia editor in a pnpm workspaces monorepo.

## Features

- **Project editing**: Import video to create projects; multi-track, multiple clip types (video, image, text, canvas elements, etc.)
- **Preview playback**: Real-time preview synced with the timeline; play/pause, seek, canvas background
- **Timeline**: Multi-track timeline, clip drag & select, thumbnails
- **Library**: Video, image, text, TTS, recording, canvas, audio panels; managed from the sidebar
- **Media & export**: Mediabunny-based parsing and canvas output pipeline (via `@vitecut/media` and related packages)

## Project structure

```
ViteCut/
├── packages/
│   ├── app/                      # React frontend (editor UI)
│   │   └── src/
│   │       ├── editor/           # Layout, preview, timeline, library
│   │       ├── stores/            # Zustand (projectStore, etc.)
│   │       └── components/
│   └── @vitecut/
│       ├── project/              # Project data (Asset, Track, Clip)
│       ├── timeline/             # Timeline data & React wrapper
│       ├── canvas/                # Canvas editing & rendering
│       ├── media/                 # Media parsing & export (Mediabunny)
│       ├── audio/
│       ├── renderer/
│       ├── record/
│       └── utils/
├── pnpm-workspace.yaml
└── package.json
```

## Online demo

- **Online demo**: [https://www.vitecut.com](https://www.vitecut.com)

## Requirements

- **Node.js**: 18+
- **Package manager**: pnpm

Install dependencies:

```bash
pnpm install
```

## Scripts

| Command               | Description                                     |
| --------------------- | ----------------------------------------------- |
| `pnpm dev`            | Start dev server (with default video project)   |
| `pnpm build`          | Build all packages and app in order             |
| `pnpm build:packages` | Build only `@vitecut/*` packages                |
| `pnpm build:app`      | Build only app (build packages first if needed) |
| `pnpm build:timeline` | Build @vitecut/timeline only                    |
| `pnpm build:canvas`   | Build @vitecut/canvas only                      |
| `pnpm lint`           | Lint entire repo                                |
| `pnpm preview`        | Preview built app                               |
| `pnpm clean`          | Remove all `dist` directories                   |

## Deployment (GitHub Pages)

- **Workflow**: on each push to `master`, `.github/workflows/deploy.yml` builds the app and deploys to GitHub Pages.
- **Build command**: `pnpm build:app` with `GITHUB_PAGES=true` so `vite.config.ts` uses `base: "/ViteCut/"`.
- **Output path**: the GitHub Pages workflow uploads `packages/app/dist` as the site artifact.

To locally simulate the GitHub Pages build:

```bash
GITHUB_PAGES=true pnpm build:app
```

## Tech stack

- **App**: React 19, TypeScript, Vite
- **State**: Zustand (single project store + preview state: currentTime, isPlaying, duration)
- **Media**: Mediabunny (parsing, encoding), Canvas API (preview & export)
- **Timeline UI**: @xzdarcy/react-timeline-editor

## Core concepts

- **Project**: Root data (canvas size, fps, assets, tracks, clips).
- **Preview**: Driven by `currentTime` / `isPlaying`; renders video, image, text, canvas at the current time.
- **Store**: `projectStore` exposes `project`, `currentTime`, `duration`, `isPlaying`, `videoUrl`, `canvasBackgroundColor`, and actions like `loadVideoFile`, time/playback controls.

## Packages (overview)

- **app**: Editor UI (Header, Library, Preview, Timeline); depends on `@vitecut/*`.
- **@vitecut/project**: Project, asset, track, clip types and data structures.
- **@vitecut/timeline**: Timeline data transform and React timeline component.
- **@vitecut/canvas**: Canvas editing and output.
- **@vitecut/media**: Mediabunny-based media probing, input, and canvas video output.
- **@vitecut/utils**: ID generation, time formatting, etc.

See each package’s `README.md` for details.

## Development tips

1. After changing `@vitecut/*` packages, run `pnpm build:packages` then `pnpm dev` if the app doesn’t pick up changes.
2. An empty project auto-loads a default video; main state and API are in `packages/app/src/stores/projectStore.types.ts`.

## License

See per-package license (e.g. `packages/app/LICENSE`).
