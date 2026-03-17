import type {
  WorkflowComposerNodeData,
  WorkflowComposerNodeKind,
  WorkflowEdgeStyleOption,
  WorkflowNodeGroup,
} from "./workflowTypes";

export const INPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([
  "prompt",
  "reference-image",
]);

export const OUTPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([
  "save-media",
  "insert-timeline",
]);

export const ALLOWED_CONNECTIONS: Record<
  WorkflowComposerNodeKind,
  readonly WorkflowComposerNodeKind[]
> = {
  prompt: ["prompt-optimize", "image-generate", "video-generate"],
  "reference-image": [
    "image-reverse-prompt",
    "image-generate",
    "video-generate",
  ],
  "image-reverse-prompt": ["prompt-optimize", "image-generate", "video-generate"],
  "prompt-optimize": ["image-generate", "video-generate"],
  "image-params-adjust": ["image-generate"],
  "image-generate": ["video-generate", "save-media", "insert-timeline"],
  "video-generate": ["save-media", "insert-timeline"],
  "save-media": [],
  "insert-timeline": [],
};

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

export const IMAGE_MODEL_OPTIONS = [
  { id: "doubao-seedream-5.0-lite", name: "Seedream 5.0 Lite" },
  { id: "doubao-seedream-4.5", name: "Seedream 4.5" },
  { id: "doubao-seedream-4.0", name: "Seedream 4.0" },
  { id: "doubao-seedream-3.0-t2i", name: "Seedream 3.0 T2I" },
] as const;

export const IMAGE_ASPECT_RATIO_OPTIONS = [
  "smart",
  "21:9",
  "16:9",
  "3:2",
  "4:3",
  "1:1",
  "3:4",
  "2:3",
  "9:16",
] as const;

export const IMAGE_RESOLUTION_OPTIONS = [
  { id: "2k", label: "高清 2K" },
  { id: "4k", label: "超清 4K" },
] as const;

export const VIDEO_MODEL_OPTIONS = [
  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro" },
  { id: "seedance-1.0-pro", name: "Seedance 1.0 Pro" },
] as const;

export const VIDEO_ASPECT_RATIO_OPTIONS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "21:9",
] as const;

export const MAX_REFERENCE_IMAGES = 14;

export const PROMPT_OPTIMIZE_MODEL_ID = "doubao-seed-1.8";
export const PROMPT_OPTIMIZE_MODEL_OPTIONS = [
  { id: "doubao-seed-1.8", name: "doubao-seed-1.8" },
] as const;

export const REVERSE_PROMPT_MODEL_ID = "doubao-seed-1.8";
export const REVERSE_PROMPT_MODEL_OPTIONS = [
  { id: "doubao-seed-1.8", name: "doubao-seed-1.8" },
] as const;

export const NODE_LIBRARY: Array<WorkflowComposerNodeData> = [
  {
    kind: "prompt",
    label: "提示词输入",
    summary: "定义主体、场景、镜头和风格约束。",
    accent: "#6ee7b7",
  },
  {
    kind: "reference-image",
    label: "参考图",
    summary: "上传角色、风格板或关键视觉做条件输入。",
    accent: "#7dd3fc",
  },
  {
    kind: "image-reverse-prompt",
    label: "图片反推提示词",
    summary: "从参考图反推场景、风格、镜头和关键词，生成可编辑提示词。",
    accent: "#34d399",
    model: REVERSE_PROMPT_MODEL_ID,
  },
  {
    kind: "prompt-optimize",
    label: "提示词优化",
    summary: "对原始提示词做润色、扩写、结构化，提升生成稳定性。",
    accent: "#22c55e",
    model: PROMPT_OPTIMIZE_MODEL_ID,
  },
  {
    kind: "image-params-adjust",
    label: "图片参数调整",
    summary: "统一设置比例、分辨率、风格强度和生成批量参数。",
    accent: "#f59e0b",
    model: "Image Params",
  },
  {
    kind: "image-generate",
    label: "图片生成",
    summary: "绑定模型、比例、分辨率和尺寸参数。",
    accent: "#fbbf24",
    model: "doubao-seedream-5.0-lite",
    ratio: "smart",
    resolution: "2k",
    width: 3024,
    height: 1296,
    dimensionsLinked: true,
  },
  {
    kind: "video-generate",
    label: "视频生成",
    summary: "基于关键帧扩展成镜头片段，支持时长预设。",
    accent: "#fb7185",
    model: "seedance-1.5-pro",
    ratio: "16:9",
    resolution: "2k",
  },
  {
    kind: "save-media",
    label: "保存到素材库",
    summary: "输出结果统一保存到素材库，后续可直接插入时间线。",
    accent: "#c084fc",
    outputTarget: "library",
  },
  {
    kind: "insert-timeline",
    label: "插入时间线",
    summary: "不区分图片或视频类型，统一把上游结果落到时间线。",
    accent: "#38bdf8",
    outputTarget: "timeline",
    timelineInsertAt: "00:00:00",
  },
];

export const NODE_GROUPS: WorkflowNodeGroup[] = [
  {
    title: "输入",
    kinds: ["prompt", "reference-image"],
  },
  {
    title: "提示词处理",
    kinds: ["image-reverse-prompt", "prompt-optimize"],
  },
  {
    title: "参数",
    kinds: ["image-params-adjust"],
  },
  {
    title: "生成",
    kinds: ["image-generate", "video-generate"],
  },
  {
    title: "输出",
    kinds: ["save-media", "insert-timeline"],
  },
];
