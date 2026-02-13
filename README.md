**English** | [中文](README.zh-CN.md)

---

# SwiftAV

Web-based video/multimedia editor in a pnpm workspaces monorepo.

## Features

- **Project editing**: Import video to create projects; multi-track, multiple clip types (video, image, text, canvas elements, etc.)
- **Preview playback**: Real-time preview synced with the timeline; play/pause, seek, canvas background
- **Timeline**: Multi-track timeline, clip drag & select, thumbnails
- **Library**: Video, image, text, TTS, recording, canvas, audio panels; managed from the sidebar
- **Media & export**: Mediabunny-based parsing and canvas output pipeline (via `@swiftav/media` and related packages)

## Project structure

```
SwiftAV/
├── packages/
│   ├── app/                      # React frontend (editor UI)
│   │   └── src/
│   │       ├── editor/           # Layout, preview, timeline, library
│   │       ├── stores/            # Zustand (projectStore, etc.)
│   │       └── components/
│   └── @swiftav/
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

## Requirements

- **Node.js**: 18+
- **Package manager**: pnpm

Install dependencies:

```bash
pnpm install
```

## Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start dev server (with default video project) |
| `pnpm build` | Build all packages and app in order |
| `pnpm build:packages` | Build only `@swiftav/*` packages |
| `pnpm build:app` | Build only app (build packages first if needed) |
| `pnpm build:timeline` | Build @swiftav/timeline only |
| `pnpm build:canvas` | Build @swiftav/canvas only |
| `pnpm lint` | Lint entire repo |
| `pnpm preview` | Preview built app |
| `pnpm clean` | Remove all `dist` directories |

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

- **app**: Editor UI (Header, Library, Preview, Timeline); depends on `@swiftav/*`.
- **@swiftav/project**: Project, asset, track, clip types and data structures.
- **@swiftav/timeline**: Timeline data transform and React timeline component.
- **@swiftav/canvas**: Canvas editing and output.
- **@swiftav/media**: Mediabunny-based media probing, input, and canvas video output.
- **@swiftav/utils**: ID generation, time formatting, etc.

See each package’s `README.md` for details.

## Development tips

1. After changing `@swiftav/*` packages, run `pnpm build:packages` then `pnpm dev` if the app doesn’t pick up changes.
2. An empty project auto-loads a default video; main state and API are in `packages/app/src/stores/projectStore.types.ts`.

## License

See per-package license (e.g. `packages/app/LICENSE`).
