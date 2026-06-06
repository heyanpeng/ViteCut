# 画布双击快速添加菜单 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在 `@vitecut/workflow` 包里实现「画布空白处双击 → 弹出分组式快速添加菜单」，9 项均为占位 + toast，提供 `onShowToast` 回调让消费方接入既有 Toaster。

**Architecture:** 在 `WorkflowComposer.tsx` 加 `quickAdd` 状态、`onDoubleClick` 事件、文档级 ESC、以及在既有 `onPaneClick / onNodeClick / onMoveStart` 里追加关闭兜底；菜单数据/视觉/clamp 抽到独立 `workflowQuickAddConfig.ts` + `WorkflowQuickAddMenu.tsx` + `.css`；toast 优先走 prop 回调，无回调时使用包内 1.8s 兜底浮层。

**Tech Stack:** React 19、@xyflow/react v12、lucide-react、radix-ui（均为包内现有依赖，无新增）。

**Spec:** `docs/superpowers/specs/2026-06-06-canvas-double-click-quick-add-menu-design.md`

**No-test-infra note:** 工作流包无单测/E2E 设施。每个 Task 的验证为 `tsc --noEmit` + 文末「Task 8 手测脚本」。

---

## File Structure

新增（全部在 `packages/@vitecut/workflow/src/`）：
- `workflowQuickAddConfig.ts` — 菜单数据（3 组 / 9 项）
- `WorkflowQuickAddMenu.tsx` — 受控菜单组件（约 100 行，clamp + render）
- `WorkflowQuickAddMenu.css` — 菜单样式
- `WorkflowEmbeddedToast.tsx` — 包内兜底 toast（约 40 行）
- `WorkflowEmbeddedToast.css` — 兜底 toast 样式

修改：
- `workflowIcons.tsx` — 新增 9 个 lucide glyph 导出
- `workflowTypes.ts` — `WorkflowComposerProps` 新增 `onShowToast`
- `WorkflowComposer.tsx` — state、事件、关闭兜底、菜单渲染、`showToast` 桥接
- `packages/app/src/editor/library/panels/ai/WorkflowGenDialog.tsx` — 把 `useToast().showToast` 接到 `onShowToast`

---

## Task 1: 新增 9 个 lucide glyph 导出

**Files:**
- Modify: `packages/@vitecut/workflow/src/workflowIcons.tsx`

- [ ] **Step 1.1: 追加 9 个 lucide 导入**

打开 `packages/@vitecut/workflow/src/workflowIcons.tsx`，把现有 `import { ... } from "lucide-react";` 一行扩展为（**保留**已有的所有图标，**新增**末尾 9 个）：

```tsx
import {
  ArrowLeftRight,
  AudioLines,
  Clapperboard,
  Clock4,
  Contact,
  Globe,
  ImagePlus,
  Layers,
  LayoutGrid,
  LogOut,
  MousePointer2,
  Play,
  Plus,
  Replace,
  Save,
  Scissors,
  Trash2,
  Type,
  Upload,
  Video,
  Wand2,
  Workflow,
} from "lucide-react";
```

- [ ] **Step 1.2: 文件末尾追加 9 个 glyph 组件**

在 `MyFlowGlyph` 后追加：

```tsx
export function TextGlyph({ size = 18 }: { size?: number }) {
  return <Type size={size} strokeWidth={1.6} aria-hidden />;
}

export function ImageGlyph({ size = 18 }: { size?: number }) {
  return <ImagePlus size={size} strokeWidth={1.6} aria-hidden />;
}

export function VideoGlyph({ size = 18 }: { size?: number }) {
  return <Video size={size} strokeWidth={1.6} aria-hidden />;
}

export function WorldGlyph({ size = 18 }: { size?: number }) {
  return <Globe size={size} strokeWidth={1.6} aria-hidden />;
}

export function AudioGlyph({ size = 18 }: { size?: number }) {
  return <AudioLines size={size} strokeWidth={1.6} aria-hidden />;
}

export function StoryboardGlyph({ size = 18 }: { size?: number }) {
  return <LayoutGrid size={size} strokeWidth={1.6} aria-hidden />;
}

export function AppGlyph({ size = 18 }: { size?: number }) {
  return <Layers size={size} strokeWidth={1.6} aria-hidden />;
}

export function UploadGlyph({ size = 18 }: { size?: number }) {
  return <Upload size={size} strokeWidth={1.6} aria-hidden />;
}

export function ImportGlyph({ size = 18 }: { size?: number }) {
  return <Clock4 size={size} strokeWidth={1.6} aria-hidden />;
}
```

- [ ] **Step 1.3: 类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit
```

Expected: 退出码 0，无输出。

- [ ] **Step 1.4: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/workflowIcons.tsx \
  && git commit -m "feat(workflow): add 9 lucide glyphs for quick-add menu"
```

---

## Task 2: 新增菜单数据配置

**Files:**
- Create: `packages/@vitecut/workflow/src/workflowQuickAddConfig.ts`

- [ ] **Step 2.1: 创建文件**

写入 `packages/@vitecut/workflow/src/workflowQuickAddConfig.ts`：

```tsx
import type { ReactElement } from "react";
import {
  AppGlyph,
  AudioGlyph,
  ImageGlyph,
  ImportGlyph,
  StoryboardGlyph,
  TextGlyph,
  UploadGlyph,
  VideoGlyph,
  WorldGlyph,
} from "./workflowIcons";

export type QuickAddItem = {
  id: string;
  label: string;
  desc?: string;
  icon: ReactElement;
};

export type QuickAddGroup = {
  id: string;
  title?: string;
  divider?: boolean;
  items: QuickAddItem[];
};

export const QUICK_ADD_GROUPS: QuickAddGroup[] = [
  {
    id: "node",
    title: "添加节点",
    items: [
      {
        id: "text",
        label: "文本",
        desc: "脚本、广告词、品牌文案",
        icon: <TextGlyph />,
      },
      { id: "image", label: "图片", icon: <ImageGlyph /> },
      { id: "video", label: "视频", icon: <VideoGlyph /> },
      { id: "world3d", label: "3D 世界", icon: <WorldGlyph /> },
      { id: "audio", label: "音频", icon: <AudioGlyph /> },
    ],
  },
  {
    id: "function",
    title: "功能节点",
    items: [
      { id: "storyboard", label: "分镜格子", icon: <StoryboardGlyph /> },
      { id: "ai-app", label: "AI 应用", icon: <AppGlyph /> },
    ],
  },
  {
    id: "resource",
    title: "添加资源",
    divider: true,
    items: [
      { id: "upload", label: "上传", icon: <UploadGlyph /> },
      { id: "import-work", label: "从作品导入", icon: <ImportGlyph /> },
    ],
  },
];
```

- [ ] **Step 2.2: 类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 2.3: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/workflowQuickAddConfig.ts \
  && git commit -m "feat(workflow): add quick-add menu config (3 groups, 9 items)"
```

---

## Task 3: 新增菜单组件 + CSS（静态渲染）

本 Task 实现组件渲染、clamp 与事件抛出，但**还不在 WorkflowComposer 里挂载**。

**Files:**
- Create: `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx`
- Create: `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css`

- [ ] **Step 3.1: 写 CSS**

写入 `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css`：

```css
.vitecut-quick-add {
  position: absolute;
  z-index: 9;
  width: 296px;
  padding: 6px 8px 10px;
  border-radius: 18px;
  background: rgba(22, 26, 32, 0.95);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.04),
    0 18px 48px rgba(0, 0, 0, 0.55);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  color: #eef1f6;
  font-family:
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  animation: vitecut-quick-add-in 140ms cubic-bezier(0.22, 1, 0.36, 1) both;
}

.vitecut-quick-add__group + .vitecut-quick-add__group {
  margin-top: 2px;
}

.vitecut-quick-add__group--divider {
  border-top: 1px solid rgba(255, 255, 255, 0.06);
  margin-top: 6px;
  padding-top: 4px;
}

.vitecut-quick-add__title {
  padding: 10px 14px 4px;
  font-size: 12px;
  letter-spacing: 0.04em;
  color: rgba(229, 233, 240, 0.45);
  font-weight: 500;
}

.vitecut-quick-add__item {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  height: 56px;
  padding: 0 12px;
  border-radius: 12px;
  border: 0;
  background: transparent;
  color: inherit;
  text-align: left;
  cursor: pointer;
  transition:
    background-color 140ms ease,
    border-color 140ms ease;
}

.vitecut-quick-add__item:hover,
.vitecut-quick-add__item:focus-visible {
  background: rgba(255, 255, 255, 0.06);
  outline: none;
}

.vitecut-quick-add:not(:hover)
  .vitecut-quick-add__group:first-child
  .vitecut-quick-add__item:first-child {
  background: rgba(255, 255, 255, 0.03);
}

.vitecut-quick-add__icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid rgba(255, 255, 255, 0.05);
  color: rgba(232, 236, 244, 0.92);
  transition: border-color 140ms ease;
}

.vitecut-quick-add__item:hover .vitecut-quick-add__icon,
.vitecut-quick-add__item:focus-visible .vitecut-quick-add__icon {
  border-color: rgba(255, 255, 255, 0.1);
}

.vitecut-quick-add__text {
  min-width: 0;
  display: flex;
  flex-direction: column;
}

.vitecut-quick-add__label {
  font-size: 15px;
  font-weight: 500;
  color: #eef1f6;
  line-height: 1.2;
}

.vitecut-quick-add__desc {
  margin-top: 2px;
  font-size: 12px;
  color: rgba(229, 233, 240, 0.5);
  line-height: 1.2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

@keyframes vitecut-quick-add-in {
  from {
    opacity: 0;
    transform: translateY(6px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vitecut-quick-add {
    animation: none;
  }
}
```

- [ ] **Step 3.2: 写组件**

写入 `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx`：

```tsx
import { useLayoutEffect, useRef, useState } from "react";
import { QUICK_ADD_GROUPS } from "./workflowQuickAddConfig";
import "./WorkflowQuickAddMenu.css";

const MARGIN = 8;
const ESTIMATED_WIDTH = 296;
const ESTIMATED_HEIGHT = 480;

export type WorkflowQuickAddMenuProps = {
  open: boolean;
  anchor: { x: number; y: number } | null;
  containerSize: { width: number; height: number };
  onPickSoon: (label: string) => void;
  onClose: () => void;
};

export function WorkflowQuickAddMenu({
  open,
  anchor,
  containerSize,
  onPickSoon,
  onClose,
}: WorkflowQuickAddMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    const width = rect?.width ?? ESTIMATED_WIDTH;
    const height = rect?.height ?? ESTIMATED_HEIGHT;
    const maxLeft = Math.max(MARGIN, containerSize.width - width - MARGIN);
    const maxTop = Math.max(MARGIN, containerSize.height - height - MARGIN);
    setPosition({
      left: Math.min(Math.max(anchor.x, MARGIN), maxLeft),
      top: Math.min(Math.max(anchor.y, MARGIN), maxTop),
    });
  }, [
    open,
    anchor?.x,
    anchor?.y,
    containerSize.width,
    containerSize.height,
  ]);

  if (!open || !anchor) return null;

  const handlePick = (label: string) => {
    onPickSoon(label);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="vitecut-quick-add"
      role="menu"
      aria-label="快速添加"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      style={{
        left: position?.left ?? anchor.x,
        top: position?.top ?? anchor.y,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {QUICK_ADD_GROUPS.map((group) => (
        <div
          key={group.id}
          className={
            group.divider
              ? "vitecut-quick-add__group vitecut-quick-add__group--divider"
              : "vitecut-quick-add__group"
          }
        >
          {group.title ? (
            <div className="vitecut-quick-add__title">{group.title}</div>
          ) : null}
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="vitecut-quick-add__item"
              onClick={() => handlePick(item.label)}
            >
              <span className="vitecut-quick-add__icon">{item.icon}</span>
              <span className="vitecut-quick-add__text">
                <span className="vitecut-quick-add__label">{item.label}</span>
                {item.desc ? (
                  <span className="vitecut-quick-add__desc">{item.desc}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
```

> 设计要点：首次渲染 `visibility: hidden` 防止一帧错位；`useLayoutEffect` 测量真实尺寸 + 容器尺寸做 clamp 后再 `visible`。组件不接 outside-click / ESC，关闭由 WorkflowComposer 负责，避免双重监听器。

- [ ] **Step 3.3: 类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 3.4: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx \
            packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css \
  && git commit -m "feat(workflow): add quick-add menu component with clamp"
```

---

## Task 4: WorkflowComposerProps 加 onShowToast；包内兜底 toast

**Files:**
- Modify: `packages/@vitecut/workflow/src/workflowTypes.ts`
- Create: `packages/@vitecut/workflow/src/WorkflowEmbeddedToast.tsx`
- Create: `packages/@vitecut/workflow/src/WorkflowEmbeddedToast.css`

- [ ] **Step 4.1: workflowTypes 加 onShowToast**

打开 `packages/@vitecut/workflow/src/workflowTypes.ts`，找到 `WorkflowComposerProps`（接口或 type 任一形态），在末尾追加可选字段：

```ts
onShowToast?: (message: string) => void;
```

> 若已存在其它 optional 字段，加在末尾即可；不要重新整理顺序。

- [ ] **Step 4.2: 写兜底 toast CSS**

写入 `packages/@vitecut/workflow/src/WorkflowEmbeddedToast.css`：

```css
.vitecut-embed-toast {
  position: fixed;
  left: 50%;
  bottom: 32px;
  transform: translateX(-50%);
  z-index: 9999;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  border-radius: 14px;
  background: rgba(22, 26, 32, 0.92);
  border: 1px solid rgba(255, 255, 255, 0.06);
  box-shadow: 0 12px 30px rgba(0, 0, 0, 0.45);
  color: #eef1f6;
  font-size: 14px;
  font-family:
    "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", -apple-system,
    BlinkMacSystemFont, "Segoe UI", sans-serif;
  animation: vitecut-embed-toast-in 200ms ease both;
  pointer-events: none;
}

.vitecut-embed-toast__dot {
  width: 6px;
  height: 6px;
  border-radius: 999px;
  background: #7cf5b6;
  box-shadow: 0 0 8px rgba(124, 245, 182, 0.6);
}

@keyframes vitecut-embed-toast-in {
  from {
    opacity: 0;
    transform: translate(-50%, 6px);
  }
  to {
    opacity: 1;
    transform: translate(-50%, 0);
  }
}

@media (prefers-reduced-motion: reduce) {
  .vitecut-embed-toast {
    animation: none;
  }
}
```

- [ ] **Step 4.3: 写兜底 toast 组件**

写入 `packages/@vitecut/workflow/src/WorkflowEmbeddedToast.tsx`：

```tsx
import { useEffect, useState } from "react";
import "./WorkflowEmbeddedToast.css";

export type EmbeddedToastHandle = {
  show: (message: string) => void;
};

export function useEmbeddedToast(): {
  toast: { key: number; message: string } | null;
  show: (message: string) => void;
} {
  const [toast, setToast] = useState<{ key: number; message: string } | null>(
    null
  );

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 1800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  return {
    toast,
    show: (message: string) =>
      setToast({ key: Date.now() + Math.random(), message }),
  };
}

export function WorkflowEmbeddedToast({
  toast,
}: {
  toast: { key: number; message: string } | null;
}) {
  if (!toast) return null;
  return (
    <div key={toast.key} className="vitecut-embed-toast" role="status">
      <span className="vitecut-embed-toast__dot" aria-hidden />
      <span>{toast.message}</span>
    </div>
  );
}
```

- [ ] **Step 4.4: 类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 4.5: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/workflowTypes.ts \
            packages/@vitecut/workflow/src/WorkflowEmbeddedToast.tsx \
            packages/@vitecut/workflow/src/WorkflowEmbeddedToast.css \
  && git commit -m "feat(workflow): add onShowToast prop and embedded fallback toast"
```

---

## Task 5: 在 WorkflowComposer 接入菜单 + 兜底 toast

这是最关键的一步：state、双击事件、关闭兜底、菜单/toast 渲染、`showToast` 桥接。

**Files:**
- Modify: `packages/@vitecut/workflow/src/WorkflowComposer.tsx`

- [ ] **Step 5.1: 追加导入**

打开 `packages/@vitecut/workflow/src/WorkflowComposer.tsx`，找到顶部既有的本地导入区（`workflowIcons` 那一段下面），追加：

```tsx
import { WorkflowQuickAddMenu } from "./WorkflowQuickAddMenu";
import {
  WorkflowEmbeddedToast,
  useEmbeddedToast,
} from "./WorkflowEmbeddedToast";
```

- [ ] **Step 5.2: 解构 props 加 onShowToast**

找到 `WorkflowComposerInner({...}: WorkflowComposerProps)` 的解构（在文件顶部约 line 63-72），在末尾追加 `onShowToast`：

```tsx
function WorkflowComposerInner({
  title = "工作流生成",
  subtitle = "用节点把提示词、参考图、图片生成、视频生成串成一个可复用流程。",
  onExit,
  onDeleteWorkflow,
  deletingWorkflow = false,
  savingWorkflow = false,
  initialWorkflow,
  onSave,
  onShowToast,
}: WorkflowComposerProps) {
```

- [ ] **Step 5.3: 加 state、兜底 toast、showToast 桥接**

在 `rootRef` 那一行（约 line 73：`const rootRef = useRef<HTMLDivElement | null>(null);`）下面追加：

```tsx
const [quickAddAnchor, setQuickAddAnchor] = useState<{
  x: number;
  y: number;
} | null>(null);
const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
const { toast: embeddedToast, show: showEmbeddedToast } = useEmbeddedToast();

const showToast = useCallback(
  (message: string) => {
    if (onShowToast) {
      onShowToast(message);
    } else {
      showEmbeddedToast(message);
    }
  },
  [onShowToast, showEmbeddedToast]
);
```

- [ ] **Step 5.4: 容器尺寸跟随 resize**

在上一段之后追加：

```tsx
useEffect(() => {
  const el = rootRef.current;
  if (!el) return;
  const update = () => {
    setContainerSize({ width: el.clientWidth, height: el.clientHeight });
  };
  update();
  if (typeof ResizeObserver !== "undefined") {
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }
  window.addEventListener("resize", update);
  return () => window.removeEventListener("resize", update);
}, []);
```

- [ ] **Step 5.5: 双击事件 + ESC 关闭**

继续追加：

```tsx
const handleCanvasDoubleClick = useCallback(
  (event: React.MouseEvent<HTMLDivElement>) => {
    const target = event.target as HTMLElement | null;
    if (!target) return;
    if (!target.closest(".react-flow__pane")) return;
    if (target.closest(".react-flow__node, .react-flow__edge")) return;
    const rect = rootRef.current?.getBoundingClientRect();
    if (!rect) return;
    event.preventDefault();
    setQuickAddAnchor({
      x: event.clientX - rect.left,
      y: event.clientY - rect.top,
    });
  },
  []
);

useEffect(() => {
  if (!quickAddAnchor) return;
  const onKey = (event: KeyboardEvent) => {
    if (event.key === "Escape") setQuickAddAnchor(null);
  };
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
}, [quickAddAnchor]);
```

- [ ] **Step 5.6: 现有 pane/node/move 回调内追加关闭**

定位现有的 ReactFlow props（约 line 982-1010），在以下三个 handler 里加 `setQuickAddAnchor(null);`：

`onNodeClick={(_, node) => { ... }}` 内最前面或最后追加：
```tsx
setQuickAddAnchor(null);
```

`onPaneClick={() => { ... }}` 内追加：
```tsx
setQuickAddAnchor(null);
```

`onMoveStart={() => { ... }}` 内追加：
```tsx
setQuickAddAnchor(null);
```

> 注意：edge 单击不需要关菜单（菜单打开时通常 pane 已被遮罩，不会先点到 edge）；但为稳妥起见，在 `onEdgeClick={(event, edge) => { ... }}` 内也追加一行 `setQuickAddAnchor(null);`。

- [ ] **Step 5.7: 把 onDoubleClick 挂到 root 容器**

找到 `<div ref={rootRef} className="vitecut-workflow" ...>`（约 line 522-530），在其 props 上追加 `onDoubleClick={handleCanvasDoubleClick}`：

```tsx
<div
  ref={rootRef}
  className="vitecut-workflow"
  style={{
    height: "100%",
    position: "relative",
  }}
  onDoubleClick={handleCanvasDoubleClick}
>
```

- [ ] **Step 5.8: 渲染菜单 + 兜底 toast**

定位 root 容器的关闭 `</div>`（文件接近末尾，整个组件的最后一个 JSX 节点收尾）。在该 `</div>` 之前追加：

```tsx
<WorkflowQuickAddMenu
  open={Boolean(quickAddAnchor)}
  anchor={quickAddAnchor}
  containerSize={containerSize}
  onPickSoon={(label) => showToast(`${label}即将上线`)}
  onClose={() => setQuickAddAnchor(null)}
/>
<WorkflowEmbeddedToast toast={embeddedToast} />
```

- [ ] **Step 5.9: 类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit
```

Expected: 退出码 0。

- [ ] **Step 5.10: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/WorkflowComposer.tsx \
  && git commit -m "feat(workflow): wire quick-add menu and toast into WorkflowComposer"
```

---

## Task 6: 在 packages/app 接入既有 Toaster

**Files:**
- Modify: `packages/app/src/editor/library/panels/ai/WorkflowGenDialog.tsx`

- [ ] **Step 6.1: 引入 useToast**

打开 `packages/app/src/editor/library/panels/ai/WorkflowGenDialog.tsx`，在顶部 import 区追加（路径基于该文件 `panels/ai/` 的相对深度，向上 4 级到 `src`）：

```tsx
import { useToast } from "../../../../components/Toaster";
```

- [ ] **Step 6.2: 取得 showToast 并传给 WorkflowComposer**

在 `WorkflowGenDialog` 组件函数体顶部（`const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);` 这一行附近）追加：

```tsx
const { showToast } = useToast();
```

然后在 `<WorkflowComposerComponent ... />` 的 props 列表里追加（与 `onSave={onSave}` 同级）：

```tsx
onShowToast={(message) => showToast(message, "info")}
```

整体看起来：

```tsx
<WorkflowComposerComponent
  onExit={() => onOpenChange(false)}
  onDeleteWorkflow={
    onDeleteWorkflow ? () => setDeleteConfirmOpen(true) : undefined
  }
  deletingWorkflow={deletingWorkflow}
  savingWorkflow={savingWorkflow}
  initialWorkflow={initialWorkflow}
  onSave={onSave}
  onShowToast={(message) => showToast(message, "info")}
/>
```

- [ ] **Step 6.3: 构建 workflow 包，确保新类型导出**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && pnpm -F @vitecut/workflow build 2>&1 | tail -10
```

Expected: 输出末尾包含 `dist/` 复制（`cp src/*.css dist/`）成功，无 TS error。

- [ ] **Step 6.4: 在 app 内类型校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/app \
  && ../../node_modules/.bin/tsc --noEmit 2>&1 | head -40
```

Expected: 退出码 0，无输出。

- [ ] **Step 6.5: Commit**

```bash
cd /Users/heyanpeng/project/ViteCut \
  && git add packages/app/src/editor/library/panels/ai/WorkflowGenDialog.tsx \
  && git commit -m "feat(app): wire toaster to workflow quick-add menu"
```

---

## Task 7: 视觉 polish — 兜底 toast 关闭动画与菜单淡出

可选，但已在 spec 视觉规范里承诺关闭 100ms 渐出。如果当前 mount/unmount 直接消失对体验影响小，可跳过；本 Task 实现淡出。

**Files:**
- Modify: `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css`
- Modify: `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx`

- [ ] **Step 7.1: 评估是否需要做**

若 Task 8 手测中关闭瞬间体验良好，跳过 Task 7（标注为「skipped」并直接进入收尾）。否则继续。

- [ ] **Step 7.2: 给菜单加 closing 状态淡出**

在 `WorkflowQuickAddMenu.css` 末尾追加：

```css
.vitecut-quick-add--closing {
  animation: vitecut-quick-add-out 100ms ease both;
  pointer-events: none;
}

@keyframes vitecut-quick-add-out {
  to {
    opacity: 0;
    transform: translateY(2px);
  }
}
```

修改 `WorkflowQuickAddMenu.tsx`：把 `open` 与内部 `mounted` 解耦——内部维持 `mounted` state，`open` 变 false 时延迟 100ms 再卸载，并在过渡期加 `--closing` class。这一步如果增加复杂度过高，可改为放弃淡出。

- [ ] **Step 7.3: 类型校验 + commit**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit \
  && cd /Users/heyanpeng/project/ViteCut \
  && git add packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx \
            packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css \
  && git commit -m "polish(workflow): add quick-add menu close fade-out"
```

---

## Task 8: 手测脚本

**Files:** 无代码改动。完成下面手测清单后，Plan 收官。

- [ ] **Step 8.1: 起 dev server**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/app \
  && pnpm dev
```

Expected: vite 启动，控制台输出本地 URL（如 `http://localhost:5173`）。

- [ ] **Step 8.2: 浏览器逐项验证**

打开应用，进入工作流生成弹窗（确保是空白工作流）。逐项勾选：

- [ ] 双击画布空白处 → 菜单在鼠标处出现
- [ ] 菜单首项「文本」默认有轻微高亮，鼠标移到任意其它项后首项高亮消失
- [ ] 任选一项（如「3D 世界」）→ toast 在屏幕中下出现「3D 世界即将上线」，菜单关闭，画布节点数不变
- [ ] 双击靠近右边缘的空白 → 菜单整体左移，不被截断；靠近下边缘同理
- [ ] 按 ESC → 菜单关闭
- [ ] 双击空白打开菜单后，单击空白 → 菜单关闭
- [ ] 双击空白打开菜单后，单击已有节点 → 菜单关闭
- [ ] 双击空白打开菜单后，按住空格平移画布 → 菜单关闭
- [ ] 双击已有**节点**或**连线** → 菜单**不**出现
- [ ] 兜底 toast 验证：临时把 `WorkflowGenDialog.tsx` 里的 `onShowToast={...}` 注释掉一次，刷新页面，再走任一项 → 屏幕中下出现包内胶囊 toast「<名称>即将上线」，1.8s 自动消失。验证通过后**恢复**注释。

- [ ] **Step 8.3: 关闭 dev server，最终 tsc 校验**

```bash
cd /Users/heyanpeng/project/ViteCut/packages/@vitecut/workflow \
  && ../../../node_modules/.bin/tsc --noEmit \
  && cd /Users/heyanpeng/project/ViteCut/packages/app \
  && ../../node_modules/.bin/tsc --noEmit
```

Expected: 两次均退出码 0。

- [ ] **Step 8.4: 收尾（无需 commit，本 Task 不改代码）**

确认 `git status` 干净；至此 Plan 完成。

---

## Self-review 结果（写者自审）

- ✅ Spec §触发与关闭：Task 5 覆盖（双击 + ESC + onPaneClick/onNodeClick/onMoveStart/onEdgeClick 清理）
- ✅ Spec §坐标计算：Task 3 clamp + Task 5 anchor 计算
- ✅ Spec §文件结构 - 新增/修改：全部对应 Task 1-6
- ✅ Spec §数据模型：Task 2
- ✅ Spec §组件 API：Task 3
- ✅ Spec §WorkflowComposer 集成：Task 5
- ✅ Spec §Toast 策略（prop 优先 + 包内兜底）：Task 4-5-6
- ✅ Spec §视觉规范：Task 3 CSS + Task 4 toast CSS + Task 7（淡出）
- ✅ Spec §测试 / 验收：Task 8
- ✅ Spec §风险（双击命中过滤 / clamp / caller 未传 toast / NODE_LIBRARY 解耦）：均已在 Task 3/5/4 里体现
- ✅ 类型一致性：`QuickAddItem` / `QuickAddGroup` / `WorkflowQuickAddMenuProps` 在 Task 2-3 中定义后，Task 5 引用名一致
