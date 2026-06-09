import type {
  WorkflowComposerNodeData,
  WorkflowComposerNodeKind,
  WorkflowEdgeStyleOption,
  WorkflowNodeGroup,
} from "./workflowTypes";

export const INPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([
  "prompt",
  "image",
]);

export const OUTPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([]);

export const ALLOWED_CONNECTIONS: Record<
  WorkflowComposerNodeKind,
  readonly WorkflowComposerNodeKind[]
> = {
  prompt: [],
  image: [],
};

export const PROMPT_MODEL_OPTIONS = [
  { id: "all-language-g3", name: "全能语言模型G3" },
  { id: "all-language-g4", name: "全能语言模型G4" },
] as const;

export const EDGE_STYLE_OPTIONS: WorkflowEdgeStyleOption[] = [
  {
    id: "bezier",
    label: "贝塞尔",
    desc: "曲线连接，转折更柔和。",
    edgeType: "default",
  },
  {
    id: "orthogonal",
    label: "正交",
    desc: "折线连接，结构更规整。",
    edgeType: "smoothstep",
  },
];

export const NODE_LIBRARY: Array<WorkflowComposerNodeData> = [
  {
    kind: "prompt",
    label: "提示词输入",
    summary: "定义主体、场景、镜头和风格约束。",
    accent: "#6ee7b7",
  },
  {
    kind: "image",
    label: "图片",
    summary: "上传图片，做图生图、图生视频、换背景、首帧扩展等下游操作。",
    accent: "#7dd3fc",
  },
];

export const NODE_GROUPS: WorkflowNodeGroup[] = [
  { title: "输入", kinds: ["prompt", "image"] },
];
