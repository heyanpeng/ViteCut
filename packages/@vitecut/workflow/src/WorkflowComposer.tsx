import { memo, useCallback, useMemo, useRef, useState } from "react";
import { Switch } from "radix-ui";
import { snowflake } from "@vitecut/utils";
import {
  addEdge,
  Background,
  Controls,
  Handle,
  MarkerType,
  Position,
  ReactFlow,
  ReactFlowProvider,
  useReactFlow,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
  type Node,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import "./WorkflowComposer.css";

export type WorkflowComposerNodeKind =
  | "prompt"
  | "reference-image"
  | "image-reverse-prompt"
  | "prompt-optimize"
  | "image-params-adjust"
  | "image-generate"
  | "video-generate"
  | "save-media"
  | "insert-timeline";

export interface WorkflowComposerNodeData extends Record<string, unknown> {
  label: string;
  kind: WorkflowComposerNodeKind;
  summary: string;
  accent: string;
  reverseImageUrl?: string;
  referenceImageUrls?: string[];
  videoStartFrameUrl?: string;
  videoEndFrameUrl?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  width?: number;
  height?: number;
  dimensionsLinked?: boolean;
  outputTarget?: string;
  timelineInsertAt?: string;
}

export interface WorkflowComposerProps {
  title?: string;
  subtitle?: string;
  onExit?: () => void;
  onSave?: (payload: {
    name: string;
    nodes: WorkflowFlowNode[];
    edges: Edge[];
  }) => void;
}

type WorkflowFlowNode = Node<WorkflowComposerNodeData, "workflowNode">;
type WorkflowEdgeStyle = "bezier" | "orthogonal";
type WorkflowSidebarMenu = "nodes" | "workflow";

const INPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([
  "prompt",
  "reference-image",
]);

const OUTPUT_NODE_KINDS = new Set<WorkflowComposerNodeKind>([
  "save-media",
  "insert-timeline",
]);
const ALLOWED_CONNECTIONS: Record<
  WorkflowComposerNodeKind,
  readonly WorkflowComposerNodeKind[]
> = {
  prompt: ["prompt-optimize", "image-generate", "video-generate"],
  "reference-image": ["image-reverse-prompt", "image-generate", "video-generate"],
  "image-reverse-prompt": ["prompt-optimize", "image-generate", "video-generate"],
  "prompt-optimize": ["image-generate", "video-generate"],
  "image-params-adjust": ["image-generate"],
  "image-generate": ["video-generate", "save-media", "insert-timeline"],
  "video-generate": ["save-media", "insert-timeline"],
  "save-media": [],
  "insert-timeline": [],
};

const EDGE_STYLE_OPTIONS: Array<{
  id: WorkflowEdgeStyle;
  label: string;
  desc: string;
  edgeType: "default" | "smoothstep";
}> = [
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

const IMAGE_MODEL_OPTIONS = [
  { id: "doubao-seedream-5.0-lite", name: "Seedream 5.0 Lite" },
  { id: "doubao-seedream-4.5", name: "Seedream 4.5" },
  { id: "doubao-seedream-4.0", name: "Seedream 4.0" },
  { id: "doubao-seedream-3.0-t2i", name: "Seedream 3.0 T2I" },
] as const;

const IMAGE_ASPECT_RATIO_OPTIONS = [
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

const IMAGE_RESOLUTION_OPTIONS = [
  { id: "2k", label: "高清 2K" },
  { id: "4k", label: "超清 4K" },
] as const;

const VIDEO_MODEL_OPTIONS = [
  { id: "seedance-1.5-pro", name: "Seedance 1.5 Pro" },
  { id: "seedance-1.0-pro", name: "Seedance 1.0 Pro" },
] as const;

const VIDEO_ASPECT_RATIO_OPTIONS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "21:9",
] as const;

const MAX_REFERENCE_IMAGES = 14;
const PROMPT_OPTIMIZE_MODEL_ID = "doubao-seed-1.8";
const PROMPT_OPTIMIZE_MODEL_OPTIONS = [
  { id: "doubao-seed-1.8", name: "doubao-seed-1.8" },
] as const;
const REVERSE_PROMPT_MODEL_ID = "doubao-seed-1.8";
const REVERSE_PROMPT_MODEL_OPTIONS = [
  { id: "doubao-seed-1.8", name: "doubao-seed-1.8" },
] as const;

function WorkflowNodeCard({
  data,
  selected,
}: {
  data: WorkflowComposerNodeData;
  selected?: boolean;
}) {
  const borderColor = selected ? `${data.accent}cc` : `${data.accent}55`;
  const imageModelName =
    IMAGE_MODEL_OPTIONS.find((item) => item.id === data.model)?.name ??
    data.model?.toString() ??
    "";
  const videoModelName =
    VIDEO_MODEL_OPTIONS.find((item) => item.id === data.model)?.name ??
    data.model?.toString() ??
    "";
  const referenceImageCount = Array.isArray(data.referenceImageUrls)
    ? data.referenceImageUrls.length
    : 0;
  const imageReferencePreviewUrls =
    data.kind === "image-generate" && Array.isArray(data.referenceImageUrls)
      ? data.referenceImageUrls.slice(0, 4)
      : [];
  const videoFramePreviewUrls =
    data.kind === "video-generate"
      ? [
          data.videoStartFrameUrl?.toString() ?? "",
          data.videoEndFrameUrl?.toString() ?? "",
        ].filter((item) => item.length > 0)
      : [];
  const isGenerateNode =
    data.kind === "image-generate" || data.kind === "video-generate";
  const hasReverseImage =
    data.kind === "image-reverse-prompt" &&
    typeof data.reverseImageUrl === "string" &&
    data.reverseImageUrl.length > 0;
  return (
    <div
      style={{
        minWidth: 196,
        maxWidth: 240,
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        background:
          "linear-gradient(180deg, rgba(20,24,34,0.96) 0%, rgba(10,12,18,0.98) 100%)",
        boxShadow: "none",
        transition: "border-color 160ms ease",
        color: "#f6f7fb",
        overflow: "hidden",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          border: "2px solid rgba(255,255,255,0.82)",
          background: data.accent,
        }}
      />
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 8,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {data.label}
      </div>
      {isGenerateNode ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 8,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {data.summary}
        </div>
      ) : null}
      {data.kind === "image-generate" && imageReferencePreviewUrls.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 6,
            marginBottom: 8,
          }}
        >
          {imageReferencePreviewUrls.map((url, index) => (
            <div
              key={`${url.slice(0, 24)}-${index}`}
              style={{
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <img
                src={url}
                alt={`参考图 ${index + 1}`}
                style={{
                  width: "100%",
                  height: 28,
                  display: "block",
                  objectFit: "cover",
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {hasReverseImage ? (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <img
            src={data.reverseImageUrl}
            alt="反推输入图"
            style={{
              width: "100%",
              height: 112,
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
      ) : data.kind === "image-reverse-prompt" ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.52)",
          }}
        >
          暂未上传图片
        </div>
      ) : data.kind === "image-generate" ? (
        <div style={{ display: "grid", gap: 4 }}>
          {[
            { key: "模型", value: imageModelName || "-" },
            { key: "比例", value: data.ratio?.toString() ?? "smart" },
            { key: "分辨率", value: data.resolution?.toString() ?? "2k" },
            {
              key: "尺寸",
              value: `${Number(data.width ?? 3024)}×${Number(data.height ?? 1296)}`,
            },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.42)" }}>{item.key}</span>
              <span
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  textAlign: "right",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : data.kind === "video-generate" ? (
        <div style={{ display: "grid", gap: 4 }}>
          {videoFramePreviewUrls.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 6,
                marginBottom: 4,
              }}
            >
              {[
                { key: "首", url: data.videoStartFrameUrl?.toString() ?? "" },
                { key: "尾", url: data.videoEndFrameUrl?.toString() ?? "" },
              ].map((item) =>
                item.url ? (
                  <div
                    key={`${item.key}-${item.url.slice(0, 20)}`}
                    style={{
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <img
                      src={item.url}
                      alt={`${item.key}帧`}
                      style={{
                        width: "100%",
                        height: 28,
                        display: "block",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={`${item.key}-empty`}
                    style={{
                      borderRadius: 6,
                      border: "1px dashed rgba(255,255,255,0.16)",
                      color: "rgba(255,255,255,0.42)",
                      fontSize: 10,
                      minHeight: 28,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {item.key}帧
                  </div>
                )
              )}
            </div>
          ) : null}
          {[
            { key: "模型", value: videoModelName || "-" },
            { key: "比例", value: data.ratio?.toString() ?? "16:9" },
            { key: "分辨率", value: data.resolution?.toString() ?? "2k" },
            { key: "时长", value: `${Number(data.duration ?? 5)}s` },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.42)" }}>{item.key}</span>
              <span
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  textAlign: "right",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.7)",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {data.summary}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          border: "2px solid rgba(255,255,255,0.82)",
          background: data.accent,
        }}
      />
    </div>
  );
}

const WorkflowNode = memo(WorkflowNodeCard);

function SidebarGlyph({
  kind,
}: {
  kind: WorkflowSidebarMenu;
}) {
  if (kind === "nodes") {
    return (
      <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
        <path
          d="M9 4.5V13.5M4.5 9H13.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  return (
    <svg width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden>
      <circle cx="4.5" cy="4.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="13.5" cy="4.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="9" cy="13.5" r="2.1" stroke="currentColor" strokeWidth="1.4" />
      <path
        d="M6.6 4.5H11.4M5.7 6.1L7.9 11.7M12.3 6.1L10.1 11.7"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function DeleteGlyph({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M4 7h16M10 11v6M14 11v6M9 4h6l1 2H8l1-2Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M7 7l1 12a2 2 0 0 0 2 2h4a2 2 0 0 0 2-2l1-12"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SwapGlyph({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M7 7h13m0 0-3-3m3 3-3 3M17 17H4m0 0 3-3m-3 3 3 3"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SaveGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M5 4h11l3 3v13H5V4Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 4v6h8V4M9 20v-6h6v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function ExitGlyph({ size = 14 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M14 7l5 5-5 5M19 12H9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M10 4H5v16h5"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const nodeTypes = {
  workflowNode: WorkflowNode,
};

const NODE_LIBRARY: Array<{
  kind: WorkflowComposerNodeKind;
  label: string;
  summary: string;
  accent: string;
  reverseImageUrl?: string;
  referenceImageUrls?: string[];
  videoStartFrameUrl?: string;
  videoEndFrameUrl?: string;
  model?: string;
  ratio?: string;
  resolution?: string;
  width?: number;
  height?: number;
  dimensionsLinked?: boolean;
  outputTarget?: string;
  timelineInsertAt?: string;
}> = [
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

const NODE_GROUPS: Array<{
  title: string;
  kinds: WorkflowComposerNodeKind[];
}> = [
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

const createInitialFlow = (): { nodes: WorkflowFlowNode[]; edges: Edge[] } => {
  const nodeIds = {
    prompt: snowflake(),
    reference: snowflake(),
    image: snowflake(),
    video: snowflake(),
    save: snowflake(),
    timeline: snowflake(),
    reverse: snowflake(),
    optimize: snowflake(),
    params: snowflake(),
  } as const;

  const nodes: WorkflowFlowNode[] = [
    {
      id: nodeIds.prompt,
      type: "workflowNode",
      position: { x: 80, y: 110 },
      data: { ...NODE_LIBRARY[0] },
    },
    {
      id: nodeIds.reference,
      type: "workflowNode",
      position: { x: 80, y: 300 },
      data: { ...NODE_LIBRARY[1] },
    },
    {
      id: nodeIds.image,
      type: "workflowNode",
      position: { x: 620, y: 180 },
      data: { ...NODE_LIBRARY[5] },
    },
    {
      id: nodeIds.video,
      type: "workflowNode",
      position: { x: 900, y: 180 },
      data: { ...NODE_LIBRARY[6] },
    },
    {
      id: nodeIds.save,
      type: "workflowNode",
      position: { x: 1200, y: 90 },
      data: { ...NODE_LIBRARY[7] },
    },
    {
      id: nodeIds.timeline,
      type: "workflowNode",
      position: { x: 1200, y: 270 },
      data: { ...NODE_LIBRARY[8] },
    },
    {
      id: nodeIds.reverse,
      type: "workflowNode",
      position: { x: 320, y: 80 },
      data: { ...NODE_LIBRARY[2] },
    },
    {
      id: nodeIds.optimize,
      type: "workflowNode",
      position: { x: 320, y: 230 },
      data: { ...NODE_LIBRARY[3] },
    },
    {
      id: nodeIds.params,
      type: "workflowNode",
      position: { x: 320, y: 380 },
      data: { ...NODE_LIBRARY[4] },
    },
  ];

  const edges: Edge[] = [
    {
      id: snowflake(),
      source: nodeIds.prompt,
      target: nodeIds.optimize,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#79ffe1", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.reference,
      target: nodeIds.reverse,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#7dd3fc", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.reverse,
      target: nodeIds.optimize,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#34d399", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.optimize,
      target: nodeIds.params,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#22c55e", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.params,
      target: nodeIds.image,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#f59e0b", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.image,
      target: nodeIds.video,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#fda4af", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.video,
      target: nodeIds.save,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#d8b4fe", strokeWidth: 2 },
    },
    {
      id: snowflake(),
      source: nodeIds.image,
      target: nodeIds.timeline,
      animated: false,
      markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
      style: { stroke: "#67e8f9", strokeWidth: 2 },
    },
  ];

  return { nodes, edges };
};

const { nodes: INITIAL_NODES, edges: INITIAL_EDGES } = createInitialFlow();

function WorkflowComposerInner({
  title = "工作流生成",
  subtitle = "用节点把提示词、参考图、图片生成、视频生成串成一个可复用流程。",
  onExit,
  onSave,
}: WorkflowComposerProps) {
  const { screenToFlowPosition } = useReactFlow<WorkflowFlowNode, Edge>();
  const [workflowName, setWorkflowName] = useState("未命名工作流");
  const [flowNodes, setFlowNodes, onNodesChange] =
    useNodesState<WorkflowFlowNode>(INITIAL_NODES);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [edgeStyle, setEdgeStyle] = useState<WorkflowEdgeStyle>("bezier");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [activeSidebarMenu, setActiveSidebarMenu] =
    useState<WorkflowSidebarMenu | null>(null);
  const reverseImageInputRef = useRef<HTMLInputElement | null>(null);
  const imageRefsInputRef = useRef<HTMLInputElement | null>(null);
  const videoStartFrameInputRef = useRef<HTMLInputElement | null>(null);
  const videoEndFrameInputRef = useRef<HTMLInputElement | null>(null);

  const nodeById = useMemo(
    () => new Map(flowNodes.map((node) => [node.id, node])),
    [flowNodes]
  );

  const selectedNode = selectedNodeId ? nodeById.get(selectedNodeId) : undefined;
  const activeEdgeStyle =
    EDGE_STYLE_OPTIONS.find((option) => option.id === edgeStyle) ??
    EDGE_STYLE_OPTIONS[1];
  const animatedEdgeIds = useMemo(() => {
    if (!selectedNodeId) return new Set<string>();
    const ids = new Set<string>();

    // Forward: animate all descendants from the selected node.
    const forwardVisited = new Set<string>([selectedNodeId]);
    const forwardQueue = [selectedNodeId];
    while (forwardQueue.length > 0) {
      const currentId = forwardQueue.shift();
      if (!currentId) continue;
      flowEdges.forEach((edge) => {
        if (edge.source !== currentId) return;
        ids.add(edge.id);
        if (!forwardVisited.has(edge.target)) {
          forwardVisited.add(edge.target);
          forwardQueue.push(edge.target);
        }
      });
    }

    // Backward: animate all ancestors up to root.
    const backwardVisited = new Set<string>([selectedNodeId]);
    const backwardQueue = [selectedNodeId];
    while (backwardQueue.length > 0) {
      const currentId = backwardQueue.shift();
      if (!currentId) continue;
      flowEdges.forEach((edge) => {
        if (edge.target !== currentId) return;
        ids.add(edge.id);
        if (!backwardVisited.has(edge.source)) {
          backwardVisited.add(edge.source);
          backwardQueue.push(edge.source);
        }
      });
    }

    return ids;
  }, [flowEdges, selectedNodeId]);
  const displayEdges = useMemo(
    () =>
      flowEdges.map((edge) => ({
        ...edge,
        animated: Boolean(selectedNodeId && animatedEdgeIds.has(edge.id)),
      })),
    [animatedEdgeIds, flowEdges, selectedNodeId]
  );

  const createNodeId = useCallback(
    (_kind: WorkflowComposerNodeKind) => snowflake(),
    []
  );

  const isValidConnection = useCallback(
    (connectionLike: Connection | Edge) => {
      const connection: Connection = {
        source: connectionLike.source,
        target: connectionLike.target,
        sourceHandle: connectionLike.sourceHandle ?? null,
        targetHandle: connectionLike.targetHandle ?? null,
      };
      if (!connection.source || !connection.target) return false;
      if (connection.source === connection.target) return false;
      const sourceNode = nodeById.get(connection.source);
      const targetNode = nodeById.get(connection.target);
      if (!sourceNode || !targetNode) return false;
      const sourceKind = sourceNode.data.kind;
      const targetKind = targetNode.data.kind;
      if (OUTPUT_NODE_KINDS.has(sourceKind)) return false;
      if (INPUT_NODE_KINDS.has(targetKind)) return false;
      if (!ALLOWED_CONNECTIONS[sourceKind]?.includes(targetKind)) return false;
      if (
        flowEdges.some(
          (edge) =>
            edge.source === connection.source && edge.target === connection.target
        )
      ) {
        return false;
      }
      return true;
    },
    [flowEdges, nodeById]
  );

  const handleConnect = useCallback(
    (connection: Connection) => {
      if (!isValidConnection(connection)) return;
      const sourceAccent =
        nodeById.get(connection.source ?? "")?.data.accent?.toString() ??
        "#94a3b8";
      setFlowEdges((currentEdges) =>
        addEdge(
          {
            ...connection,
            id: `${connection.source}-${connection.target}`,
            animated: false,
            type: activeEdgeStyle.edgeType,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
            },
            style: {
              stroke: sourceAccent,
              strokeWidth: 2,
            },
          },
          currentEdges
        )
      );
    },
    [activeEdgeStyle.edgeType, isValidConnection, nodeById, setFlowEdges]
  );

  const handleEdgeStyleChange = useCallback(
    (nextStyle: WorkflowEdgeStyle) => {
      const option =
        EDGE_STYLE_OPTIONS.find((item) => item.id === nextStyle) ??
        EDGE_STYLE_OPTIONS[1];
      setEdgeStyle(nextStyle);
      setFlowEdges((current) =>
        current.map((edge) => ({
          ...edge,
          type: option.edgeType,
        }))
      );
    },
    [setFlowEdges]
  );

  const handleNodeDragStart = useCallback(
    (event: React.DragEvent<HTMLButtonElement>, kind: WorkflowComposerNodeKind) => {
      event.dataTransfer.setData("application/vitecut-workflow-node", kind);
      event.dataTransfer.effectAllowed = "move";
    },
    []
  );

  const handleCanvasDragOver = useCallback((event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
  }, []);

  const handleCanvasDrop = useCallback(
    (event: React.DragEvent) => {
      event.preventDefault();
      const kind = event.dataTransfer.getData(
        "application/vitecut-workflow-node"
      ) as WorkflowComposerNodeKind;
      const template = NODE_LIBRARY.find((item) => item.kind === kind);
      if (!template) return;
      const position = screenToFlowPosition({
        x: event.clientX,
        y: event.clientY,
      });
      const newNode: WorkflowFlowNode = {
        id: createNodeId(kind),
        type: "workflowNode",
        position,
        data: { ...template },
      };
      setFlowNodes((current) => [...current, newNode]);
      setSelectedNodeId(newNode.id);
    },
    [createNodeId, screenToFlowPosition, setFlowNodes]
  );

  const updateSelectedNode = useCallback(
    (patch: Partial<WorkflowComposerNodeData>) => {
      if (!selectedNodeId) return;
      setFlowNodes((current) =>
        current.map((node) =>
          node.id === selectedNodeId
            ? {
                ...node,
                data: {
                  ...node.data,
                  ...patch,
                },
              }
            : node
        )
      );
    },
    [selectedNodeId, setFlowNodes]
  );

  const deleteSelectedNode = useCallback(() => {
    if (!selectedNodeId) return;
    setFlowNodes((current) => current.filter((node) => node.id !== selectedNodeId));
    setFlowEdges((current) =>
      current.filter(
        (edge) => edge.source !== selectedNodeId && edge.target !== selectedNodeId
      )
    );
    setSelectedNodeId("");
  }, [selectedNodeId, setFlowEdges, setFlowNodes]);

  const selectedNodeTypeTitle = selectedNode
    ? NODE_LIBRARY.find((item) => item.kind === selectedNode.data.kind)?.label ??
      selectedNode.data.kind
    : "";
  const configLabelStyle = { fontSize: 12, color: "rgba(255,255,255,0.48)" };
  const configInputStyle = {
    width: "100%",
    boxSizing: "border-box",
    minHeight: 36,
    padding: "8px 10px",
    fontSize: 13,
    color: "#f8fafc",
    background: "rgba(255,255,255,0.04)",
    border: "1px solid rgba(255,255,255,0.08)",
    borderRadius: 10,
  } as const;
  const uploadTriggerStyle = {
    minHeight: 38,
    padding: "9px 12px",
    fontSize: 12,
    color: "rgba(248,250,252,0.86)",
    background: "rgba(255,255,255,0.04)",
    border: "1px dashed rgba(255,255,255,0.2)",
    borderRadius: 10,
    cursor: "pointer",
    textAlign: "center",
  } as const;
  const previewDeleteButtonStyle = {
    position: "absolute",
    top: 6,
    right: 6,
    zIndex: 2,
    width: 28,
    height: 28,
    padding: 0,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: "none",
    borderRadius: 6,
    background: "rgba(0,0,0,0.6)",
    color: "#fff",
    cursor: "pointer",
  } as const;
  const updateNodeField = useCallback(
    (key: string, value: unknown) =>
      updateSelectedNode({ [key]: value } as Partial<WorkflowComposerNodeData>),
    [updateSelectedNode]
  );
  const handleSaveWorkflow = useCallback(() => {
    const payload = {
      name: workflowName.trim() || "未命名工作流",
      nodes: flowNodes,
      edges: flowEdges,
    };
    console.log("[WorkflowComposer] save workflow payload:", payload);
    onSave?.(payload);
  }, [onSave, workflowName, flowNodes, flowEdges]);
  const handleReversePromptImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          updateSelectedNode({ reverseImageUrl: result });
        }
      };
      reader.readAsDataURL(file);
    },
    [updateSelectedNode]
  );
  const handleImageGenerateReferenceUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(event.target.files ?? []);
      event.currentTarget.value = "";
      if (!files.length) return;
      Promise.all(
        files.map(
          (file) =>
            new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => {
                if (typeof reader.result === "string") resolve(reader.result);
                else reject(new Error("invalid file result"));
              };
              reader.onerror = () => reject(reader.error ?? new Error("read failed"));
              reader.readAsDataURL(file);
            })
        )
      )
        .then((urls) => {
          const prev = Array.isArray(selectedNode?.data.referenceImageUrls)
            ? selectedNode.data.referenceImageUrls
            : [];
          updateSelectedNode({
            referenceImageUrls: [...prev, ...urls].slice(0, MAX_REFERENCE_IMAGES),
          });
        })
        .catch(() => {
          // ignore single-file decode failures to keep panel interaction smooth
        });
    },
    [selectedNode, updateSelectedNode]
  );
  const handleVideoFrameUpload = useCallback(
    (field: "videoStartFrameUrl" | "videoEndFrameUrl", file?: File | null) => {
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          updateSelectedNode({ [field]: reader.result });
        }
      };
      reader.readAsDataURL(file);
    },
    [updateSelectedNode]
  );
  const handleImageGenerateAspectRatioChange = useCallback(
    (ratio: string) => {
      if (!selectedNode || selectedNode.data.kind !== "image-generate") return;
      const dimensionsLinked = Boolean(selectedNode.data.dimensionsLinked ?? true);
      const resolution = String(selectedNode.data.resolution ?? "2k").toLowerCase();
      if (ratio !== "smart" && dimensionsLinked) {
        const parts = ratio.split(":");
        if (parts.length === 2) {
          const a = Number(parts[0]);
          const b = Number(parts[1]);
          if (
            Number.isFinite(a) &&
            Number.isFinite(b) &&
            a > 0 &&
            b > 0
          ) {
            const base = resolution === "4k" ? 2048 : 1024;
            const width = a >= b ? Math.round((base * a) / b) : base;
            const height = a >= b ? base : Math.round((base * b) / a);
            updateSelectedNode({ ratio, width, height });
            return;
          }
        }
      }
      updateNodeField("ratio", ratio);
    },
    [selectedNode, updateNodeField, updateSelectedNode]
  );

  return (
    <div
      className="vitecut-workflow"
      style={{
        height: "100%",
        position: "relative",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 16,
          left: 16,
          zIndex: 6,
          width: 260,
        }}
      >
        <input
          type="text"
          value={workflowName}
          onChange={(event) => setWorkflowName(event.target.value)}
          aria-label="流程名称"
          style={{
            width: "100%",
            minHeight: 36,
            padding: "8px 12px",
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(7,9,14,0.72)",
            color: "#f8fafc",
            fontSize: 14,
            fontWeight: 600,
          }}
        />
      </div>
      <div
        style={{
          position: "absolute",
          top: 16,
          right: 16,
          zIndex: 6,
          display: "flex",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={handleSaveWorkflow}
          style={{
            minHeight: 36,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 10,
            border: "1px solid rgba(125,211,252,0.38)",
            background: "rgba(14,60,92,0.46)",
            color: "#e0f2fe",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <SaveGlyph size={14} />
          保存
        </button>
        <button
          type="button"
          onClick={onExit}
          style={{
            minHeight: 36,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 10,
            border: "1px solid rgba(255,255,255,0.16)",
            background: "rgba(7,9,14,0.72)",
            color: "rgba(248,250,252,0.9)",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ExitGlyph size={14} />
          退出
        </button>
      </div>

      <div
        style={{
          position: "absolute",
          top: "50%",
          left: 16,
          transform: "translateY(-50%)",
          zIndex: 6,
          display: "flex",
          alignItems: "center",
          pointerEvents: "none",
        }}
        onMouseLeave={() => setActiveSidebarMenu(null)}
      >
        <aside
          style={{
            width: 76,
            padding: 10,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 999,
            background: "rgba(7,9,14,0.82)",
            backdropFilter: "blur(18px)",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
            pointerEvents: "auto",
          }}
        >
          <div
            style={{
              display: "grid",
              gap: 10,
            }}
          >
            {[
              { id: "nodes" as const, label: "添加", fullLabel: "添加节点" },
              { id: "workflow" as const, label: "工作流", fullLabel: "工作流" },
            ].map((item) => {
              const active = activeSidebarMenu === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setActiveSidebarMenu(item.id)}
                  onFocus={() => setActiveSidebarMenu(item.id)}
                  style={{
                    width: 56,
                    height: 56,
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 3,
                    borderRadius: 999,
                    border: active
                      ? "1px solid rgba(125,211,252,0.5)"
                      : "1px solid rgba(255,255,255,0.08)",
                    background: active
                      ? "rgba(14,60,92,0.36)"
                      : "rgba(255,255,255,0.03)",
                    color: active ? "#7dd3fc" : "rgba(248,250,252,0.72)",
                    cursor: "pointer",
                  }}
                  aria-label={item.fullLabel}
                  title={item.fullLabel}
                >
                  <SidebarGlyph kind={item.id} />
                  <span
                    style={{
                      fontSize: 10,
                      lineHeight: 1,
                      letterSpacing: "0.02em",
                      color: "inherit",
                    }}
                  >
                    {item.label}
                  </span>
                </button>
              );
            })}
          </div>
        </aside>

        {activeSidebarMenu ? (
          <div
            style={{
              position: "relative",
              marginLeft: 12,
              pointerEvents: "auto",
            }}
          >
            <div
              style={{
                position: "absolute",
                left: -12,
                top: 0,
                bottom: 0,
                width: 12,
                pointerEvents: "auto",
              }}
              aria-hidden
            />
            <aside
              className="workflow-scroll-panel"
              style={{
                width: 280,
                maxHeight: "min(70vh, 720px)",
                padding: 18,
                border: "1px solid rgba(255,255,255,0.08)",
                borderRadius: 18,
                background: "rgba(7,9,14,0.82)",
                backdropFilter: "blur(18px)",
                overflow: "auto",
                boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
              }}
            >
              {activeSidebarMenu === "workflow" ? (
                <div>
                  <div
                    style={{
                      fontSize: 11,
                      letterSpacing: "0.14em",
                      textTransform: "uppercase",
                      color: "rgba(255,255,255,0.45)",
                      marginBottom: 10,
                    }}
                  >
                    Workflow
                  </div>
                  <div
                    style={{
                      fontSize: 24,
                      fontWeight: 700,
                      lineHeight: 1.15,
                      color: "#f8fafc",
                      marginBottom: 10,
                    }}
                  >
                    {title}
                  </div>
                  <div
                    style={{
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: "rgba(255,255,255,0.66)",
                      marginBottom: 16,
                    }}
                  >
                    {subtitle}
                  </div>
                  <div
                    style={{
                      padding: 14,
                      borderRadius: 14,
                      border: "1px solid rgba(255,255,255,0.08)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <div
                      style={{
                        fontSize: 12,
                        color: "rgba(255,255,255,0.54)",
                        marginBottom: 8,
                      }}
                    >
                      当前能力
                    </div>
                    <div
                      style={{
                        display: "grid",
                        gap: 8,
                        fontSize: 13,
                        color: "rgba(248,250,252,0.78)",
                      }}
                    >
                      <div>全屏画布编辑</div>
                      <div>节点拖拽与连线</div>
                      <div>连线样式切换</div>
                      <div>右侧属性面板编辑</div>
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div style={{ display: "grid", gap: 12 }}>
                    {NODE_GROUPS.map((group) => {
                      const items = group.kinds
                        .map((kind) =>
                          NODE_LIBRARY.find((node) => node.kind === kind)
                        )
                        .filter((node): node is (typeof NODE_LIBRARY)[number] =>
                          Boolean(node)
                        );
                      if (items.length === 0) return null;
                      return (
                        <section
                          key={group.title}
                          style={{
                            display: "grid",
                            gap: 8,
                          }}
                        >
                          <div
                            style={{
                              fontSize: 11,
                              letterSpacing: "0.08em",
                              textTransform: "uppercase",
                              color: "rgba(255,255,255,0.45)",
                              padding: "0 2px",
                            }}
                          >
                            {group.title}
                          </div>
                          {items.map((item) => (
                            <button
                              key={item.kind}
                              type="button"
                              draggable
                              onDragStart={(event) =>
                                handleNodeDragStart(event, item.kind)
                              }
                              onClick={() => {
                                const newNode: WorkflowFlowNode = {
                                  id: createNodeId(item.kind),
                                  type: "workflowNode",
                                  position: {
                                    x: 280 + flowNodes.length * 18,
                                    y: 120 + flowNodes.length * 16,
                                  },
                                  data: { ...item },
                                };
                                setFlowNodes((current) => [...current, newNode]);
                                setSelectedNodeId(newNode.id);
                              }}
                              style={{
                                padding: "10px 12px",
                                textAlign: "left",
                                borderRadius: 10,
                                border: "1px solid rgba(255,255,255,0.07)",
                                background: "rgba(6,10,18,0.86)",
                                color: "rgba(255,255,255,0.82)",
                                fontSize: 13,
                                cursor: "grab",
                              }}
                            >
                              <div style={{ fontWeight: 700, marginBottom: 4 }}>
                                {item.label}
                              </div>
                              <div
                                style={{
                                  fontSize: 12,
                                  lineHeight: 1.45,
                                  color: "rgba(255,255,255,0.58)",
                                }}
                              >
                                {item.summary}
                              </div>
                            </button>
                          ))}
                        </section>
                      );
                    })}
                  </div>
                </div>
              )}
            </aside>
          </div>
        ) : null}
      </div>

      <section
        style={{
          position: "absolute",
          inset: 0,
          minWidth: 0,
        }}
        onDragOver={handleCanvasDragOver}
        onDrop={handleCanvasDrop}
      >
        <ReactFlow<WorkflowFlowNode, Edge>
          nodes={flowNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => setSelectedNodeId(node.id)}
          onPaneClick={() => setSelectedNodeId("")}
          fitView
          fitViewOptions={{ padding: 0.16 }}
          proOptions={{ hideAttribution: true }}
          nodesDraggable
          nodesConnectable
          elementsSelectable
          selectionOnDrag
          panOnDrag={false}
          panOnScroll
          panOnScrollSpeed={1.15}
          zoomOnScroll={false}
          zoomOnDoubleClick={false}
          connectionLineStyle={{
            stroke: "rgba(148, 163, 184, 0.9)",
            strokeWidth: 2,
          }}
          defaultEdgeOptions={{
            type: activeEdgeStyle.edgeType,
            animated: false,
            markerEnd: {
              type: MarkerType.ArrowClosed,
              width: 18,
              height: 18,
            },
          }}
          isValidConnection={isValidConnection}
          style={{ background: "transparent" }}
        >
          <Controls
            position="bottom-left"
            showInteractive={false}
          />
          <Background gap={24} size={1.1} color="rgba(255,255,255,0.08)" />
        </ReactFlow>
      </section>

      <aside
        style={{
          position: "absolute",
          left: 86,
          bottom: 16,
          zIndex: 5,
          width: 168,
          padding: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            minHeight: 22,
          }}
        >
          <Switch.Root
            checked={edgeStyle === "orthogonal"}
            onCheckedChange={(checked) =>
              handleEdgeStyleChange(checked ? "orthogonal" : "bezier")
            }
            aria-label="切换连线样式"
            style={{
              width: 38,
              height: 22,
              padding: 2,
              border: "1px solid rgba(255,255,255,0.14)",
              borderRadius: 999,
              background:
                edgeStyle === "orthogonal"
                  ? "rgba(14,60,92,0.62)"
                  : "rgba(255,255,255,0.1)",
              display: "inline-flex",
              alignItems: "center",
              cursor: "pointer",
            }}
          >
            <Switch.Thumb
              style={{
                width: 16,
                height: 16,
                borderRadius: 999,
                background: "#f8fafc",
                transform:
                  edgeStyle === "orthogonal"
                    ? "translateX(16px)"
                    : "translateX(0)",
                transition: "transform 160ms ease",
              }}
            />
          </Switch.Root>
          <div
            style={{
              fontSize: 12,
              color: "#f8fafc",
            }}
          >
            {edgeStyle === "orthogonal" ? "正交" : "贝塞尔"}
          </div>
        </div>
      </aside>

      {selectedNode ? (
        <aside
          style={{
            position: "absolute",
            top: 64,
            right: 16,
            bottom: 16,
            zIndex: 5,
            width: 300,
            padding: 18,
            border: "1px solid rgba(255,255,255,0.08)",
            borderRadius: 18,
            background: "rgba(7,9,14,0.78)",
            backdropFilter: "blur(18px)",
            overflow: "hidden",
            boxShadow: "0 18px 40px rgba(0,0,0,0.28)",
            display: "flex",
            flexDirection: "column",
          }}
        >
        <div
          className="workflow-scroll-panel"
          style={{
            flex: 1,
            overflow: "auto",
            paddingRight: 2,
          }}
        >
          {selectedNode ? (
            <div style={{ display: "grid", gap: 10, marginBottom: 14 }}>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 700,
                  color: "#f8fafc",
                  marginBottom: 2,
                }}
              >
                {selectedNodeTypeTitle}
              </div>
              <label style={{ display: "grid", gap: 6 }}>
                <span style={configLabelStyle}>名称</span>
                <input
                  type="text"
                  value={selectedNode.data.label.toString()}
                  onChange={(event) =>
                    updateSelectedNode({ label: event.target.value })
                  }
                  style={configInputStyle}
                />
              </label>
              {selectedNode.data.kind !== "image-reverse-prompt" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>描述</span>
                  <textarea
                    value={selectedNode.data.summary.toString()}
                    onChange={(event) =>
                      updateSelectedNode({ summary: event.target.value })
                    }
                    rows={5}
                    style={{
                      ...configInputStyle,
                      minHeight: 112,
                      lineHeight: 1.5,
                      resize: "vertical",
                    }}
                  />
                </label>
              )}
              {selectedNode.data.kind === "image-reverse-prompt" && (
                <div style={{ display: "grid", gap: 8 }}>
                  <span style={configLabelStyle}>参考图片</span>
                  <input
                    ref={reverseImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReversePromptImageUpload}
                    style={{ display: "none" }}
                  />
                  {selectedNode.data.reverseImageUrl ? (
                    <div
                      className="workflow-preview-media"
                      style={{
                        position: "relative",
                        borderRadius: 10,
                        overflow: "hidden",
                        border: "1px solid rgba(255,255,255,0.12)",
                        background: "rgba(255,255,255,0.02)",
                      }}
                    >
                      <img
                        src={selectedNode.data.reverseImageUrl.toString()}
                        alt="反推输入图"
                        style={{
                          width: "100%",
                          height: 120,
                          objectFit: "cover",
                          display: "block",
                        }}
                      />
                      <button
                        className="workflow-preview-delete-btn"
                        type="button"
                        onClick={() => updateNodeField("reverseImageUrl", "")}
                        style={previewDeleteButtonStyle}
                        aria-label="删除图片"
                      >
                        <DeleteGlyph size={16} />
                      </button>
                    </div>
                  ) : null}
                  {!selectedNode.data.reverseImageUrl ? (
                    <button
                      type="button"
                      onClick={() => reverseImageInputRef.current?.click()}
                      style={uploadTriggerStyle}
                    >
                      选择图片
                    </button>
                  ) : null}
                </div>
              )}
              {selectedNode.data.kind === "reference-image" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>输入模式</span>
                  <select
                    value={selectedNode.data.inputMode?.toString() ?? "multiple"}
                    onChange={(event) =>
                      updateNodeField("inputMode", event.target.value)
                    }
                    style={configInputStyle}
                  >
                    <option value="single">单图</option>
                    <option value="multiple">多图</option>
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "image-params-adjust" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>模型</span>
                  <input
                    type="text"
                    value={selectedNode.data.model?.toString() ?? ""}
                    onChange={(event) =>
                      updateSelectedNode({ model: event.target.value })
                    }
                    style={configInputStyle}
                  />
                </label>
              )}
              {selectedNode.data.kind === "image-reverse-prompt" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>模型</span>
                  <select
                    value={
                      REVERSE_PROMPT_MODEL_OPTIONS.some(
                        (item) => item.id === selectedNode.data.model?.toString()
                      )
                        ? selectedNode.data.model?.toString()
                        : REVERSE_PROMPT_MODEL_ID
                    }
                    onChange={(event) =>
                      updateSelectedNode({ model: event.target.value })
                    }
                    style={configInputStyle}
                  >
                    {REVERSE_PROMPT_MODEL_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "prompt-optimize" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>模型</span>
                  <select
                    value={
                      PROMPT_OPTIMIZE_MODEL_OPTIONS.some(
                        (item) => item.id === selectedNode.data.model?.toString()
                      )
                        ? selectedNode.data.model?.toString()
                        : PROMPT_OPTIMIZE_MODEL_ID
                    }
                    onChange={(event) =>
                      updateSelectedNode({ model: event.target.value })
                    }
                    style={configInputStyle}
                  >
                    {PROMPT_OPTIMIZE_MODEL_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "image-generate" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>模型</span>
                  <select
                    value={
                      IMAGE_MODEL_OPTIONS.some(
                        (item) => item.id === selectedNode.data.model?.toString()
                      )
                        ? selectedNode.data.model?.toString()
                        : IMAGE_MODEL_OPTIONS[0].id
                    }
                    onChange={(event) => updateNodeField("model", event.target.value)}
                    style={configInputStyle}
                  >
                    {IMAGE_MODEL_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "video-generate" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>模型</span>
                  <select
                    value={
                      VIDEO_MODEL_OPTIONS.some(
                        (item) => item.id === selectedNode.data.model?.toString()
                      )
                        ? selectedNode.data.model?.toString()
                        : VIDEO_MODEL_OPTIONS[0].id
                    }
                    onChange={(event) => updateNodeField("model", event.target.value)}
                    style={configInputStyle}
                  >
                    {VIDEO_MODEL_OPTIONS.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(selectedNode.data.kind === "image-params-adjust" ||
                selectedNode.data.kind === "image-generate") && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>比例</span>
                  <select
                    value={
                      selectedNode.data.kind === "image-generate"
                        ? IMAGE_ASPECT_RATIO_OPTIONS.includes(
                            (selectedNode.data.ratio?.toString() ?? "smart") as (typeof IMAGE_ASPECT_RATIO_OPTIONS)[number]
                          )
                          ? selectedNode.data.ratio?.toString()
                          : "smart"
                        : selectedNode.data.ratio?.toString() ?? "16:9"
                    }
                    onChange={(event) =>
                      selectedNode.data.kind === "image-generate"
                        ? handleImageGenerateAspectRatioChange(event.target.value)
                        : updateNodeField("ratio", event.target.value)
                    }
                    style={configInputStyle}
                  >
                    {selectedNode.data.kind === "image-generate" ? (
                      IMAGE_ASPECT_RATIO_OPTIONS.map((ratio) => (
                        <option key={ratio} value={ratio}>
                          {ratio === "smart" ? "智能" : ratio}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="1:1">1:1</option>
                        <option value="16:9">16:9</option>
                        <option value="9:16">9:16</option>
                        <option value="4:3">4:3</option>
                      </>
                    )}
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "video-generate" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>比例</span>
                  <select
                    value={
                      VIDEO_ASPECT_RATIO_OPTIONS.includes(
                        (selectedNode.data.ratio?.toString() ?? "16:9") as (typeof VIDEO_ASPECT_RATIO_OPTIONS)[number]
                      )
                        ? selectedNode.data.ratio?.toString()
                        : "16:9"
                    }
                    onChange={(event) => updateNodeField("ratio", event.target.value)}
                    style={configInputStyle}
                  >
                    {VIDEO_ASPECT_RATIO_OPTIONS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              {(selectedNode.data.kind === "image-params-adjust" ||
                selectedNode.data.kind === "video-generate") && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>分辨率</span>
                  <select
                    value={
                      selectedNode.data.kind === "video-generate"
                        ? IMAGE_RESOLUTION_OPTIONS.some(
                            (item) =>
                              item.id ===
                              (selectedNode.data.resolution?.toString() ?? "2k")
                          )
                          ? selectedNode.data.resolution?.toString()
                          : "2k"
                        : selectedNode.data.resolution?.toString() ?? "2k"
                    }
                    onChange={(event) =>
                      updateNodeField("resolution", event.target.value)
                    }
                    style={configInputStyle}
                  >
                    {selectedNode.data.kind === "video-generate" ? (
                      IMAGE_RESOLUTION_OPTIONS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))
                    ) : (
                      <>
                        <option value="720p">720p</option>
                        <option value="1080p">1080p</option>
                        <option value="2k">2K</option>
                      </>
                    )}
                  </select>
                </label>
              )}
              {selectedNode.data.kind === "image-generate" && (
                <>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>分辨率</span>
                    <select
                      value={
                        IMAGE_RESOLUTION_OPTIONS.some(
                          (item) =>
                            item.id ===
                            (selectedNode.data.resolution?.toString() ?? "2k")
                        )
                          ? selectedNode.data.resolution?.toString()
                          : "2k"
                      }
                      onChange={(event) =>
                        updateNodeField("resolution", event.target.value)
                      }
                      style={configInputStyle}
                    >
                      {IMAGE_RESOLUTION_OPTIONS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <div style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>尺寸</span>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr auto",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <input
                        type="number"
                        min={1}
                        value={Number(selectedNode.data.width ?? 3024)}
                        onChange={(event) =>
                          updateNodeField("width", Number(event.target.value))
                        }
                        style={configInputStyle}
                        aria-label="宽度"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          updateNodeField(
                            "dimensionsLinked",
                            !(selectedNode.data.dimensionsLinked ?? true)
                          )
                        }
                        style={{
                          ...configInputStyle,
                          minWidth: 56,
                          padding: "8px 0",
                          cursor: "pointer",
                        }}
                      >
                        {selectedNode.data.dimensionsLinked ?? true
                          ? "锁定"
                          : "解锁"}
                      </button>
                      <input
                        type="number"
                        min={1}
                        value={Number(selectedNode.data.height ?? 1296)}
                        onChange={(event) =>
                          updateNodeField("height", Number(event.target.value))
                        }
                        style={configInputStyle}
                        aria-label="高度"
                      />
                      <span
                        style={{
                          fontSize: 12,
                          color: "rgba(255,255,255,0.5)",
                        }}
                      >
                        PX
                      </span>
                    </div>
                  </div>
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={configLabelStyle}>参考图（可选）</span>
                    <input
                      ref={imageRefsInputRef}
                      type="file"
                      accept="image/*"
                      multiple
                      onChange={handleImageGenerateReferenceUpload}
                      style={{ display: "none" }}
                    />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                        gap: 8,
                      }}
                    >
                      {(selectedNode.data.referenceImageUrls ?? []).map((url, index) => (
                        <div
                          className="workflow-preview-media"
                          key={`${url.slice(0, 24)}-${index}`}
                          style={{
                            position: "relative",
                            borderRadius: 8,
                            overflow: "hidden",
                            border: "1px solid rgba(255,255,255,0.1)",
                          }}
                        >
                          <img
                            src={url}
                            alt={`参考图 ${index + 1}`}
                            style={{
                              width: "100%",
                              height: 68,
                              display: "block",
                              objectFit: "cover",
                            }}
                          />
                          <button
                            className="workflow-preview-delete-btn"
                            type="button"
                            onClick={() =>
                              updateNodeField(
                                "referenceImageUrls",
                                selectedNode.data.referenceImageUrls?.filter(
                                  (_, i) => i !== index
                                ) ?? []
                              )
                            }
                            style={{
                              ...previewDeleteButtonStyle,
                              top: 4,
                              right: 4,
                              width: 22,
                              height: 22,
                              borderRadius: 6,
                            }}
                            aria-label="删除参考图"
                          >
                            <DeleteGlyph size={13} />
                          </button>
                        </div>
                      ))}
                      {(selectedNode.data.referenceImageUrls?.length ?? 0) <
                      MAX_REFERENCE_IMAGES ? (
                        <button
                          type="button"
                          onClick={() => imageRefsInputRef.current?.click()}
                          style={{
                            minHeight: 68,
                            borderRadius: 8,
                            border: "1px dashed rgba(255,255,255,0.2)",
                            background: "rgba(255,255,255,0.03)",
                            color: "rgba(248,250,252,0.72)",
                            display: "grid",
                            placeItems: "center",
                            gap: 2,
                            cursor: "pointer",
                            fontSize: 11,
                          }}
                        >
                          <span style={{ fontSize: 22, lineHeight: 1 }}>+</span>
                          <span>添加</span>
                        </button>
                      ) : null}
                    </div>
                  </div>
                </>
              )}
              {selectedNode.data.kind === "video-generate" && (
                <>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>时长（秒）</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={Number(selectedNode.data.duration ?? 5)}
                      onChange={(event) =>
                        updateNodeField("duration", Number(event.target.value))
                      }
                      style={configInputStyle}
                    />
                  </label>
                  <div style={{ display: "grid", gap: 8 }}>
                    <span style={configLabelStyle}>首尾帧参考图（可选）</span>
                    <input
                      ref={videoStartFrameInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        handleVideoFrameUpload(
                          "videoStartFrameUrl",
                          event.target.files?.[0]
                        );
                        event.currentTarget.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                    <input
                      ref={videoEndFrameInputRef}
                      type="file"
                      accept="image/*"
                      onChange={(event) => {
                        handleVideoFrameUpload(
                          "videoEndFrameUrl",
                          event.target.files?.[0]
                        );
                        event.currentTarget.value = "";
                      }}
                      style={{ display: "none" }}
                    />
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "1fr auto 1fr",
                        gap: 8,
                        alignItems: "center",
                      }}
                    >
                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                          首帧
                        </div>
                        {selectedNode.data.videoStartFrameUrl ? (
                          <div
                            className="workflow-preview-media"
                            style={{
                              position: "relative",
                              borderRadius: 10,
                              overflow: "hidden",
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          >
                            <img
                              src={selectedNode.data.videoStartFrameUrl.toString()}
                              alt="首帧参考图"
                              style={{
                                width: "100%",
                                height: 96,
                                display: "block",
                                objectFit: "cover",
                              }}
                            />
                            <button
                              className="workflow-preview-delete-btn"
                              type="button"
                              onClick={() => updateNodeField("videoStartFrameUrl", "")}
                              style={previewDeleteButtonStyle}
                              aria-label="删除首帧"
                            >
                              <DeleteGlyph size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => videoStartFrameInputRef.current?.click()}
                            style={{ ...uploadTriggerStyle, minHeight: 96 }}
                          >
                            选择首帧
                          </button>
                        )}
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          updateSelectedNode({
                            videoStartFrameUrl:
                              selectedNode.data.videoEndFrameUrl?.toString() ?? "",
                            videoEndFrameUrl:
                              selectedNode.data.videoStartFrameUrl?.toString() ?? "",
                          })
                        }
                        className="workflow-frame-swap-btn"
                        style={{ marginTop: 20 }}
                        aria-label="交换首尾帧"
                        title="交换首尾帧"
                      >
                        <SwapGlyph size={20} />
                      </button>

                      <div style={{ display: "grid", gap: 6 }}>
                        <div style={{ fontSize: 11, color: "rgba(255,255,255,0.55)" }}>
                          尾帧
                        </div>
                        {selectedNode.data.videoEndFrameUrl ? (
                          <div
                            className="workflow-preview-media"
                            style={{
                              position: "relative",
                              borderRadius: 10,
                              overflow: "hidden",
                              border: "1px solid rgba(255,255,255,0.12)",
                            }}
                          >
                            <img
                              src={selectedNode.data.videoEndFrameUrl.toString()}
                              alt="尾帧参考图"
                              style={{
                                width: "100%",
                                height: 96,
                                display: "block",
                                objectFit: "cover",
                              }}
                            />
                            <button
                              className="workflow-preview-delete-btn"
                              type="button"
                              onClick={() => updateNodeField("videoEndFrameUrl", "")}
                              style={previewDeleteButtonStyle}
                              aria-label="删除尾帧"
                            >
                              <DeleteGlyph size={16} />
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={() => videoEndFrameInputRef.current?.click()}
                            style={{ ...uploadTriggerStyle, minHeight: 96 }}
                          >
                            选择尾帧
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </>
              )}
              {selectedNode.data.kind === "insert-timeline" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>插入时间点</span>
                  <input
                    type="text"
                    value={selectedNode.data.timelineInsertAt?.toString() ?? "00:00:00"}
                    onChange={(event) =>
                      updateNodeField("timelineInsertAt", event.target.value)
                    }
                    placeholder="00:00:00 或 12.5s"
                    style={configInputStyle}
                  />
                </label>
              )}
            </div>
          ) : null}
        </div>
          <button
            type="button"
            onClick={deleteSelectedNode}
            style={{
              minHeight: 36,
              padding: "8px 12px",
              color: "#fecaca",
              background: "rgba(127,29,29,0.2)",
              border: "1px solid rgba(248,113,113,0.22)",
              borderRadius: 10,
              marginTop: 12,
              cursor: "pointer",
            }}
          >
            删除节点
          </button>
      </aside>
      ) : null}
    </div>
  );
}

export function WorkflowComposer(props: WorkflowComposerProps) {
  return (
    <ReactFlowProvider>
      <WorkflowComposerInner {...props} />
    </ReactFlowProvider>
  );
}
