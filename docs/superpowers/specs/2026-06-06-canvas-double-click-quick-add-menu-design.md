# 画布双击快速添加菜单 — 设计

- **日期**：2026-06-06
- **作用域**：`packages/@vitecut/workflow`
- **关联包**：`packages/app`（消费方接入 toast 回调）

## 背景

工作流空白态目前只能通过左侧节点库添加节点。设计稿希望直接在画布空白处双击弹出一个分组式快速菜单（参考图：3 组 9 项），让用户在双击点就近创建节点。

## 目标

1. 在画布**空白处**双击弹出快速菜单，位置贴近鼠标。
2. 菜单展示 3 个分组共 9 个条目（与参考图一致）。
3. 其中 3 项（文本 / 图片 / 视频）映射到 `NODE_LIBRARY` 真实节点，在双击坐标处插入。
4. 其余 6 项作为「即将上线」占位，点击后通过 toast 提示，不创建节点。
5. 菜单具备完整的关闭兜底（ESC / 点空白 / 点节点 / 平移 / 缩放 / 选中任意项）。

## 非目标（YAGNI）

- 键盘 ↑↓ / Enter 导航
- 菜单内搜索框
- 拖拽从菜单到画布
- 右键触发（仅双击）
- 多语言（当前仅中文文案）

## 触发与关闭

| 行为 | 实现 |
| --- | --- |
| 打开 | ReactFlow 外层 wrapper 上挂 `onDoubleClick`，命中判定：`event.target.closest('.react-flow__pane')` 存在 **且** 不在 `.react-flow__node` / `.react-flow__edge` 内。 |
| 关闭 | ESC（document keydown） / 点空白（折进现有 `onPaneClick`） / 点节点（折进 `onNodeClick`） / 平移开始（折进现有 `onMoveStart`） / 选中菜单项后由组件 `onClose`。 |
| ReactFlow 原生双击缩放 | 已通过 `zoomOnDoubleClick={false}` 关闭，不冲突。 |

## 坐标计算

- **菜单屏幕坐标** = `event.clientX - containerRect.left`、`event.clientY - containerRect.top`，作为 `position: absolute` 的 `left/top`。
- **边界 clamp**：靠右/下越界时左/上平移让菜单完整落入容器。初始预设宽 300px / 高 480px 估算，挂载后用 ref 测量实际尺寸再校正一次。
- **节点 flow 坐标** = `useReactFlow().screenToFlowPosition({ x: clientX, y: clientY })`。落点即鼠标位置，**不**走现有 `addNodeFromLibrary` 内部的 `280 + i*18` 堆叠逻辑。

## 文件结构

### 新增

- `packages/@vitecut/workflow/src/workflowQuickAddConfig.ts`
- `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.tsx`
- `packages/@vitecut/workflow/src/WorkflowQuickAddMenu.css`

### 修改

- `packages/@vitecut/workflow/src/WorkflowComposer.tsx`
  - 引入 `useReactFlow` 与 `WorkflowQuickAddMenu`
  - 新增 `quickAdd` state、`onDoubleClick` 处理器
  - `addNodeFromLibrary` 接受可选 `position` 参数
  - 在 `onPaneClick` / `onNodeClick` / `onMoveStart` 里 reset `quickAdd`
  - 文档级 `keydown` 监听 ESC 关闭菜单
  - `showToast(msg)`：若 props.onShowToast 有值就转发，否则触发内置兜底 toast
- `packages/@vitecut/workflow/src/workflowTypes.ts`
  - `WorkflowComposerProps` 新增 `onShowToast?: (message: string) => void`
- `packages/@vitecut/workflow/src/workflowIcons.tsx`
  - 新增 9 个 glyph：`TextGlyph(Type)` / `ImageGlyph(ImagePlus)` / `VideoGlyph(Video)` / `WorldGlyph(Globe)` / `AudioGlyph(AudioLines)` / `StoryboardGlyph(LayoutGrid)` / `AppGlyph(Layers)` / `UploadGlyph(Upload)` / `ImportGlyph(Clock4)`
- `packages/app/src/...`（消费方接入 — 后续 plan 中列出具体改点）
  - 在渲染 `<WorkflowComposer />` 处传入 `onShowToast={showToast}`

## 数据模型

```ts
// workflowQuickAddConfig.ts
import type { ReactElement } from "react";
import type { WorkflowComposerNodeKind } from "./workflowTypes";

export type QuickAddAction =
  | { type: "node"; kind: WorkflowComposerNodeKind }
  | { type: "soon" };

export type QuickAddItem = {
  id: string;          // 稳定 id，list key 用
  label: string;       // 主标题，例：文本
  desc?: string;       // 副标题（仅「文本」有：脚本、广告词、品牌文案）
  icon: ReactElement;  // glyph，来自 workflowIcons
  action: QuickAddAction;
};

export type QuickAddGroup = {
  id: string;
  title?: string;      // 添加节点 / 功能节点 / 添加资源
  divider?: boolean;   // 该组上方是否画分割线（添加资源组为 true）
  items: QuickAddItem[];
};

export const QUICK_ADD_GROUPS: QuickAddGroup[] = [/* 见 §映射表 */];
```

### 映射表

| Group | Item | desc | Icon | Action |
| --- | --- | --- | --- | --- |
| 添加节点 | 文本 | 脚本、广告词、品牌文案 | TextGlyph | node → `prompt` |
| 添加节点 | 图片 | — | ImageGlyph | node → `reference-image` |
| 添加节点 | 视频 | — | VideoGlyph | node → `video-generate` |
| 添加节点 | 3D 世界 | — | WorldGlyph | soon |
| 添加节点 | 音频 | — | AudioGlyph | soon |
| 功能节点 | 分镜格子 | — | StoryboardGlyph | soon |
| 功能节点 | AI 应用 | — | AppGlyph | soon |
| 添加资源（divider 上方） | 上传 | — | UploadGlyph | soon |
| 添加资源 | 从作品导入 | — | ImportGlyph | soon |

## 组件 API

```tsx
// WorkflowQuickAddMenu.tsx
export type WorkflowQuickAddMenuProps = {
  open: boolean;
  anchor: { x: number; y: number } | null;          // 容器内坐标
  containerSize: { width: number; height: number };  // 用于 clamp
  onPickNode: (kind: WorkflowComposerNodeKind) => void;
  onPickSoon: (label: string) => void;
  onClose: () => void;
};
```

组件职责：
1. 关闭时 `return null`。
2. 测量自身尺寸，对 `anchor` 做 clamp 得到最终 `left/top`。
3. 渲染 3 个 group、每组 items；点击 item 时按 `action.type` 调 `onPickNode` 或 `onPickSoon`，**总是接着调 `onClose`**。
4. **不**接管 outside-click —— 关闭由 WorkflowComposer 现有的 `onPaneClick`/`onNodeClick`/keydown 兜底（点菜单内部不冒泡到 pane，`stopPropagation`）。

## WorkflowComposer 集成

```ts
const reactFlow = useReactFlow();
const [quickAdd, setQuickAdd] = useState<{
  screen: { x: number; y: number };
  flow: { x: number; y: number };
} | null>(null);

const handleCanvasDoubleClick = (event: React.MouseEvent<HTMLElement>) => {
  const target = event.target as HTMLElement;
  if (!target.closest(".react-flow__pane")) return;
  if (target.closest(".react-flow__node, .react-flow__edge")) return;
  const rect = rootRef.current?.getBoundingClientRect();
  if (!rect) return;
  setQuickAdd({
    screen: { x: event.clientX - rect.left, y: event.clientY - rect.top },
    flow: reactFlow.screenToFlowPosition({ x: event.clientX, y: event.clientY }),
  });
};
```

- `addNodeFromLibrary(data, position?)` 签名调整：当 `position` 传入则用之，否则维持原堆叠逻辑。
- 点击菜单 node 项：`addNodeFromLibrary(NODE_LIBRARY[?], quickAdd.flow)` → `setQuickAdd(null)`。
- 点击菜单 soon 项：`showToast(\`\${label}即将上线\`)` → `setQuickAdd(null)`。
- `onPaneClick` / `onNodeClick` / `onMoveStart` 内追加 `setQuickAdd(null)`。
- `useEffect` 注册 document `keydown` ESC，仅在 `quickAdd` 打开时关。

## Toast 策略

- `WorkflowComposerProps` 新增可选 `onShowToast?: (message: string) => void`。
- `showToast` 内部：
  - 若 prop 有：转发给 caller。
  - 若 prop 无：使用内置兜底——一个简单的 state（`{message, key}`），渲染为 `position: fixed; bottom: 32px; left: 50%; transform: translateX(-50%)` 的胶囊浮层，1.8s 后自动清除（setTimeout）。
- caller（`packages/app`）在渲染处接入：

```tsx
import { useToast } from "../components/Toaster";
const { show } = useToast();
<WorkflowComposer onShowToast={show} {...} />
```

## 视觉规范

- **容器**：宽 296px，padding `10px 8px`，`background: rgba(22,26,32,0.95)`，`border: 1px solid rgba(255,255,255,0.06)`，`border-radius: 18px`，`box-shadow: inset 0 1px 0 rgba(255,255,255,0.04), 0 18px 48px rgba(0,0,0,0.55)`，`backdrop-filter: blur(12px)`。
- **分组标题**：12px / `letter-spacing: 0.04em` / color `rgba(229,233,240,0.45)`，`padding: 12px 14px 6px`。
- **分割线**：「添加资源」组上方 1px `rgba(255,255,255,0.06)`，`margin: 6px 12px`。
- **列表项**：高 56px、`gap: 12px`、`padding: 0 12px`、`border-radius: 12px`。
- **图标容器**：38×38，`border-radius: 10px`，`background: rgba(255,255,255,0.04)`，`border: 1px solid rgba(255,255,255,0.05)`。
- **文字**：label 15px / `color: #eef1f6`；desc 12px / `color: rgba(229,233,240,0.5)`，单行省略。
- **hover**：row 底色 `rgba(255,255,255,0.06)`、图标容器边色 `rgba(255,255,255,0.1)`。
- **首项预亮**：第一项默认带轻微高亮（同 hover 底色弱 50%），鼠标移到任意其他项后该状态消失（通过 `.menu:not(:hover) .item:first-child` 实现）。
- **打开动画**：`opacity 0→1 + translateY 6px→0`，140ms `cubic-bezier(0.22,1,0.36,1)`。
- **关闭动画**：100ms 渐出（mount/unmount 控制 — 简单起见可省略关闭动画，立刻 unmount）。
- **内置兜底 toast**：`rgba(22,26,32,0.92)` 底，14px 文字 `#eef1f6`，左侧 6px mint 点（`#7cf5b6`），radius 14px，1.8s 后自动消失，fade 200ms。

## 测试 / 验收

1. **手测路径**（dev server 起来 → 空白工作流）：
   - 双击画布空白 → 菜单在鼠标处出现；
   - 选「文本」→ 提示词节点出现在双击位置；
   - 双击空白 → 选「音频」→ toast「音频即将上线」、节点数不变；
   - 菜单贴右边缘出现时不被截断（自动左移）；
   - ESC、点空白、点节点、按住空格平移 都能关菜单；
   - 双击节点 / 双击连线 **不**应弹菜单。
2. **类型与编译**：`pnpm -F @vitecut/workflow exec tsc --noEmit` 通过。
3. **回归**：原有节点库侧栏、节点拖拽、保存/运行按钮、删除连线 都不受影响。

## 实施顺序建议（供 writing-plans 参考）

1. `workflowIcons.tsx` 加 9 个 lucide glyph 导出。
2. 新增 `workflowQuickAddConfig.ts` 数据。
3. 新增 `WorkflowQuickAddMenu.tsx` + CSS（不接事件，先静态渲染 + clamp）。
4. `WorkflowComposer.tsx`：state、双击处理、关闭兜底、`addNodeFromLibrary` 加 position。
5. `workflowTypes.ts` 加 `onShowToast`、`packages/app` 接入。
6. 兜底 toast、动画细节。
7. 手测脚本 + tsc。

## 风险与回退

| 风险 | 缓解 |
| --- | --- |
| 双击事件命中节点/连线但仍冒泡到 wrapper | 在 handler 里通过 `closest('.react-flow__node, .react-flow__edge')` 二次过滤，已覆盖。 |
| 菜单宽度估算与实际有偏差导致一帧错位 | 挂载后 `useLayoutEffect` 读 ref 尺寸重新 clamp，最多一次 reposition。 |
| `screenToFlowPosition` 在缩放/平移下行为差异 | xyflow 官方推荐方法，已在示例中用过；测试中覆盖缩放+平移用例。 |
| caller 未传 `onShowToast` | 内置兜底浮层。 |
| 节点库 NODE_LIBRARY 重排 | quick-add 配置按 `kind` 字段查找，不依赖数组下标。 |
