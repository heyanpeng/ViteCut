**English** | [中文](README.zh-CN.md)

---

<p align="center">
  <img src="packages/app/src/assets/logo.png" alt="ViteCut" height="80" />
</p>

<p align="center">
  Web-based video & multimedia editor, built as a pnpm workspaces monorepo.
</p>

### What is ViteCut?

ViteCut is a **browser-based non-linear editor (NLE)** built with React, focused on:

- **Multi-track timeline editing** for video, image, text, audio and canvas elements
- **High‑quality preview** driven by a canvas rendering pipeline
- **Composable packages** (`@vitecut/*`) that can be reused outside the main app

It runs entirely in the browser — no native app or backend is required for editing.

### Online demo

- **Live site**: `https://www.vitecut.com`

---

## Features

- **Project & timeline**
  - Multi-track timeline with drag, trim, select, duplicate and delete
  - Multiple clip types: video, image, text, audio, canvas elements, etc.
  - Per-track mute and ordering
- **Preview**
  - Real‑time preview synced with the timeline
  - Canvas‑based renderer for consistent output
  - Configurable canvas background and size presets
- **Library**
  - Panels for video, image, text, TTS, recording, canvas and audio
  - Side-bar driven organization of all assets
- **Media & export**
  - Media probing and decoding via `@vitecut/media` (Mediabunny based)
  - Canvas output pipeline that can be reused in other apps

---

## Monorepo layout

```text
ViteCut/
├── packages/
│   ├── app/                      # React frontend (editor UI)
│   │   └── src/
│   │       ├── editor/           # Layout, preview, timeline, library
│   │       ├── stores/           # Zustand (projectStore, etc.)
│   │       └── components/
│   └── @vitecut/
│       ├── project/              # Project data (Asset, Track, Clip)
│       ├── timeline/             # Timeline data & React wrapper
│       ├── canvas/               # Canvas editing & rendering
│       ├── media/                # Media parsing & export (Mediabunny)
│       ├── audio/                # Audio‑related utilities
│       ├── renderer/             # Rendering helpers
│       ├── record/               # Recording utilities
│       └── utils/                # Shared utilities (IDs, time, etc.)
├── pnpm-workspace.yaml
└── package.json
```

Each `@vitecut/*` package is designed to be consumable on its own (see individual `README.md` files for details).

---

## Getting started

### Requirements

- **Node.js**: 18+
- **Package manager**: pnpm

### Install & run dev

```bash
# install dependencies (from repo root)
pnpm install

# start dev server (builds packages on demand)
pnpm dev
```

The dev command runs the main app under `packages/app` and launches the editor UI in the browser.

### Building

From the repo root:

```bash
# build all packages and app in dependency order
pnpm build

# or build only the workspace packages
pnpm build:packages

# or build only the app (assumes packages are already built)
pnpm build:app
```

Useful additional scripts:

| Command               | Description                    |
| --------------------- | ------------------------------ |
| `pnpm build:timeline` | Build `@vitecut/timeline` only |
| `pnpm build:canvas`   | Build `@vitecut/canvas` only   |
| `pnpm lint`           | Lint entire repo               |
| `pnpm preview`        | Preview the built app          |
| `pnpm clean`          | Remove all `dist` directories  |

---

## Tech stack

- **App**: React 19, TypeScript, Vite
- **State**: Zustand (single project store + preview state: `currentTime`, `isPlaying`, `duration`)
- **Media**: Mediabunny + Canvas API
- **Timeline UI**: `@xzdarcy/react-timeline-editor` wrapped by `@vitecut/timeline`

---

## Architecture overview

- **Project model (`@vitecut/project`)**
  - Defines `Project`, `Asset`, `Track`, `Clip` and related types
  - Used by both the timeline and preview to derive their own views
- **Timeline (`@vitecut/timeline`)**
  - Converts project data into the structure expected by `react-timeline-editor`
  - Adds a thin React wrapper (`ReactTimeline`) with additional conveniences
- **Preview (`@vitecut/canvas`, `@vitecut/media`)**
  - Uses a canvas-based editor/renderer for video, image, text and canvas clips
  - Syncs visible elements to `currentTime` and `isPlaying`
- **App (`packages/app`)**
  - Orchestrates the editor layout (Header, Library, Preview, Timeline)
  - Maintains state via a centralized `projectStore` (Zustand)

For implementation details, see the package-level READMEs and the source under `packages/app/src/editor`.

---

## Development tips

- After changing any `@vitecut/*` packages, run `pnpm build:packages` if the app does not pick up the new code.
- When there is no existing project, the app can auto-load a default video; the main project state and API live in `packages/app/src/stores/projectStore.types.ts`.

---

## License

See per-package license files (for example `packages/app/LICENSE`).  
Individual third‑party dependencies are licensed under their respective terms.
