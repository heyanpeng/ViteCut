import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Switch } from "radix-ui";
import { snowflake } from "@vitecut/utils";
import {
  addEdge,
  Background,
  Controls,
  MarkerType,
  ReactFlow,
  ReactFlowProvider,
  useEdgesState,
  useNodesState,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ALLOWED_CONNECTIONS,
  EDGE_STYLE_OPTIONS,
  IMAGE_ASPECT_RATIO_OPTIONS,
  IMAGE_MODEL_OPTIONS,
  IMAGE_RESOLUTION_OPTIONS,
  INPUT_NODE_KINDS,
  MAX_REFERENCE_IMAGES,
  NODE_GROUPS,
  NODE_LIBRARY,
  OUTPUT_NODE_KINDS,
  PROMPT_OPTIMIZE_MODEL_ID,
  PROMPT_OPTIMIZE_MODEL_OPTIONS,
  REVERSE_PROMPT_MODEL_ID,
  REVERSE_PROMPT_MODEL_OPTIONS,
  VIDEO_ASPECT_RATIO_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from "./workflowConfig";
import { INITIAL_EDGES, INITIAL_NODES } from "./initialFlow";
import { nodeTypes } from "./WorkflowNodeCard";
import {
  DeleteGlyph,
  ExitGlyph,
  PlayGlyph,
  SaveGlyph,
  ScissorsGlyph,
  SidebarGlyph,
  SwapGlyph,
} from "./workflowIcons";
import type {
  WorkflowComposerNodeData,
  WorkflowComposerNodeKind,
  WorkflowComposerProps,
  WorkflowEdgeStyle,
  WorkflowFlowNode,
  WorkflowSidebarMenu,
} from "./workflowTypes";
import "./WorkflowComposer.css";

export type {
  WorkflowComposerNodeData,
  WorkflowComposerNodeKind,
  WorkflowComposerProps,
} from "./workflowTypes";

function WorkflowComposerInner({
  title = "工作流生成",
  subtitle = "用节点把提示词、参考图、图片生成、视频生成串成一个可复用流程。",
  onExit,
  onSave,
}: WorkflowComposerProps) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const [workflowName, setWorkflowName] = useState("未命名工作流");
  const [flowNodes, setFlowNodes, onNodesChange] =
    useNodesState<WorkflowFlowNode>(INITIAL_NODES);
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState(INITIAL_EDGES);
  const [edgeStyle, setEdgeStyle] = useState<WorkflowEdgeStyle>("bezier");
  const [selectedNodeId, setSelectedNodeId] = useState<string>("");
  const [selectedEdgeId, setSelectedEdgeId] = useState<string>("");
  const [selectedEdgeAnchor, setSelectedEdgeAnchor] = useState<{
    x: number;
    y: number;
  } | null>(null);
  const [isViewportInteracting, setIsViewportInteracting] = useState(false);
  const [activeSidebarMenu, setActiveSidebarMenu] =
    useState<WorkflowSidebarMenu | null>(null);
  const referenceImageInputRef = useRef<HTMLInputElement | null>(null);
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
        animated: Boolean(
          selectedEdgeId === edge.id ||
            (selectedNodeId && animatedEdgeIds.has(edge.id))
        ),
      })),
    [animatedEdgeIds, flowEdges, selectedEdgeId, selectedNodeId]
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
  const deleteSelectedEdge = useCallback(() => {
    if (!selectedEdgeId) return;
    setFlowEdges((current) => current.filter((edge) => edge.id !== selectedEdgeId));
    setSelectedEdgeId("");
    setSelectedEdgeAnchor(null);
  }, [selectedEdgeId, setFlowEdges]);
  useEffect(() => {
    if (!selectedEdgeId) return;
    const exists = flowEdges.some((edge) => edge.id === selectedEdgeId);
    if (!exists) {
      setSelectedEdgeId("");
      setSelectedEdgeAnchor(null);
    }
  }, [flowEdges, selectedEdgeId]);
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (!selectedEdgeId) return;
      if (event.key !== "Delete" && event.key !== "Backspace") return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }
      event.preventDefault();
      setFlowEdges((current) =>
        current.filter((edge) => edge.id !== selectedEdgeId)
      );
      setSelectedEdgeId("");
      setSelectedEdgeAnchor(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [selectedEdgeId, setFlowEdges]);

  const selectedNodeTypeTitle = selectedNode
    ? NODE_LIBRARY.find((item) => item.kind === selectedNode.data.kind)?.label ??
      selectedNode.data.kind
    : "";
  const executableNodeKinds = new Set<WorkflowComposerNodeKind>([
    "image-reverse-prompt",
    "prompt-optimize",
    "image-params-adjust",
    "image-generate",
    "video-generate",
  ]);
  const canRunSelectedNode = selectedNode
    ? executableNodeKinds.has(selectedNode.data.kind)
    : false;
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
  const handleRunWorkflow = useCallback(() => {
    console.log("[WorkflowComposer] run workflow payload:", {
      name: workflowName.trim() || "未命名工作流",
      nodes: flowNodes,
      edges: flowEdges,
    });
  }, [workflowName, flowNodes, flowEdges]);
  const handleRunSelectedNode = useCallback(() => {
    if (!selectedNode) return;
    console.log("[WorkflowComposer] run node payload:", {
      workflowName: workflowName.trim() || "未命名工作流",
      node: selectedNode,
      nodes: flowNodes,
      edges: flowEdges,
    });
  }, [workflowName, selectedNode, flowNodes, flowEdges]);
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
  const handleReferenceImageUpload = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.currentTarget.value = "";
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result;
        if (typeof result === "string") {
          updateSelectedNode({ referenceImageUrls: [result] });
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
      ref={rootRef}
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
          onClick={handleRunWorkflow}
          style={{
            minHeight: 36,
            padding: "8px 14px",
            display: "inline-flex",
            alignItems: "center",
            gap: 6,
            borderRadius: 10,
            border: "1px solid rgba(134,239,172,0.3)",
            background: "rgba(20,83,45,0.38)",
            color: "#dcfce7",
            fontSize: 13,
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <PlayGlyph size={14} />
          运行工作流
        </button>
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
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 999,
            background: "rgba(15,18,28,0.9)",
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
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                background: "rgba(15,18,28,0.9)",
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
                              className="workflow-node-library-item"
                              type="button"
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
                                setActiveSidebarMenu(null);
                              }}
                              style={{
                                padding: "12px",
                                textAlign: "left",
                                display: "grid",
                                gridTemplateColumns: "auto 1fr auto",
                                gap: 10,
                                alignItems: "start",
                                borderRadius: 14,
                                border: "1px solid rgba(255,255,255,0.08)",
                                background:
                                  "linear-gradient(180deg, rgba(21,26,38,0.96) 0%, rgba(10,14,22,0.96) 100%)",
                                color: "rgba(255,255,255,0.86)",
                                fontSize: 13,
                                cursor: "grab",
                                boxShadow: "inset 0 1px 0 rgba(255,255,255,0.03)",
                              }}
                            >
                              <div
                                style={{
                                  width: 24,
                                  height: 24,
                                  borderRadius: 8,
                                  border: `1px solid ${item.accent}2e`,
                                  background: `${item.accent}0d`,
                                  display: "grid",
                                  placeItems: "center",
                                  color: `${item.accent}cc`,
                                  marginTop: 1,
                                }}
                              >
                                <div
                                  style={{
                                    width: 5,
                                    height: 5,
                                    borderRadius: 999,
                                    background: item.accent,
                                    opacity: 0.78,
                                  }}
                                />
                              </div>
                              <div
                                style={{
                                  minWidth: 0,
                                }}
                              >
                                <div
                                  style={{
                                    fontWeight: 700,
                                    marginBottom: 4,
                                    color: "#f8fafc",
                                  }}
                                >
                                  {item.label}
                                </div>
                                <div
                                  style={{
                                    fontSize: 12,
                                    lineHeight: 1.45,
                                    color: "rgba(255,255,255,0.56)",
                                    overflowWrap: "anywhere",
                                    wordBreak: "break-word",
                                  }}
                                >
                                  {item.summary}
                                </div>
                              </div>
                              <div
                                style={{
                                  paddingTop: 2,
                                  color: "rgba(255,255,255,0.34)",
                                  fontSize: 18,
                                  lineHeight: 1,
                                }}
                                aria-hidden
                              >
                                +
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
      >
        <ReactFlow<WorkflowFlowNode, Edge>
          nodes={flowNodes}
          edges={displayEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => {
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
            setSelectedNodeId(node.id);
          }}
          onNodeDragStart={() => {
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
          }}
          onEdgeClick={(event, edge) => {
            const rootRect = rootRef.current?.getBoundingClientRect();
            setSelectedNodeId("");
            setSelectedEdgeId(edge.id);
            setSelectedEdgeAnchor({
              x: rootRect ? event.clientX - rootRect.left : event.clientX,
              y: rootRect ? event.clientY - rootRect.top : event.clientY,
            });
          }}
          onPaneClick={() => {
            setSelectedNodeId("");
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
          }}
          onMoveStart={() => {
            setIsViewportInteracting(true);
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
          }}
          onMoveEnd={() => setIsViewportInteracting(false)}
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
      {selectedEdgeId && selectedEdgeAnchor && !isViewportInteracting ? (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            deleteSelectedEdge();
          }}
          style={{
            position: "absolute",
            left: selectedEdgeAnchor.x,
            top: selectedEdgeAnchor.y,
            transform: "translate(-50%, -50%)",
            zIndex: 8,
            width: 28,
            height: 28,
            padding: 0,
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            color: "#fca5a5",
            background: "rgba(127,29,29,0.86)",
            border: "1px solid rgba(248,113,113,0.5)",
            borderRadius: 999,
            cursor: "pointer",
            boxShadow: "0 6px 16px rgba(0,0,0,0.28)",
          }}
          aria-label="删除连线"
          title="删除连线"
        >
          <ScissorsGlyph size={14} />
        </button>
      ) : null}

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
            border: "1px solid rgba(255,255,255,0.12)",
            borderRadius: 18,
            background: "rgba(15,18,28,0.9)",
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
                <div style={{ display: "grid", gap: 8 }}>
                  <span style={configLabelStyle}>参考图片</span>
                  <input
                    ref={referenceImageInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleReferenceImageUpload}
                    style={{ display: "none" }}
                  />
                  {selectedNode.data.referenceImageUrls?.[0] ? (
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
                        src={selectedNode.data.referenceImageUrls[0]}
                        alt="参考图"
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
                        onClick={() => updateNodeField("referenceImageUrls", [])}
                        style={previewDeleteButtonStyle}
                        aria-label="删除图片"
                      >
                        <DeleteGlyph size={16} />
                      </button>
                    </div>
                  ) : null}
                  {!selectedNode.data.referenceImageUrls?.[0] ? (
                    <button
                      type="button"
                      onClick={() => referenceImageInputRef.current?.click()}
                      style={uploadTriggerStyle}
                    >
                      选择图片
                    </button>
                  ) : null}
                </div>
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
              {selectedNode.data.kind === "image-generate" && (
                <label style={{ display: "grid", gap: 6 }}>
                  <span style={configLabelStyle}>比例</span>
                  <select
                    value={
                      IMAGE_ASPECT_RATIO_OPTIONS.includes(
                        (selectedNode.data.ratio?.toString() ?? "smart") as (typeof IMAGE_ASPECT_RATIO_OPTIONS)[number]
                      )
                        ? selectedNode.data.ratio?.toString()
                        : "smart"
                    }
                    onChange={(event) =>
                      handleImageGenerateAspectRatioChange(event.target.value)
                    }
                    style={configInputStyle}
                  >
                    {IMAGE_ASPECT_RATIO_OPTIONS.map((ratio) => (
                      <option key={ratio} value={ratio}>
                        {ratio === "smart" ? "智能" : ratio}
                      </option>
                    ))}
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
              {selectedNode.data.kind === "video-generate" && (
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
              )}
              {selectedNode.data.kind === "image-params-adjust" && (
                <>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>亮度</span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={Number(selectedNode.data.brightness ?? 0)}
                      onChange={(event) =>
                        updateNodeField("brightness", Number(event.target.value))
                      }
                    />
                    <span style={{ ...configLabelStyle, textAlign: "right" }}>
                      {Number(selectedNode.data.brightness ?? 0)}
                    </span>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>对比度</span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={Number(selectedNode.data.contrast ?? 0)}
                      onChange={(event) =>
                        updateNodeField("contrast", Number(event.target.value))
                      }
                    />
                    <span style={{ ...configLabelStyle, textAlign: "right" }}>
                      {Number(selectedNode.data.contrast ?? 0)}
                    </span>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>饱和度</span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={Number(selectedNode.data.saturation ?? 0)}
                      onChange={(event) =>
                        updateNodeField("saturation", Number(event.target.value))
                      }
                    />
                    <span style={{ ...configLabelStyle, textAlign: "right" }}>
                      {Number(selectedNode.data.saturation ?? 0)}
                    </span>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>锐化</span>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={1}
                      value={Number(selectedNode.data.sharpness ?? 0)}
                      onChange={(event) =>
                        updateNodeField("sharpness", Number(event.target.value))
                      }
                    />
                    <span style={{ ...configLabelStyle, textAlign: "right" }}>
                      {Number(selectedNode.data.sharpness ?? 0)}
                    </span>
                  </label>
                  <label style={{ display: "grid", gap: 6 }}>
                    <span style={configLabelStyle}>色温</span>
                    <input
                      type="range"
                      min={-100}
                      max={100}
                      step={1}
                      value={Number(selectedNode.data.temperature ?? 0)}
                      onChange={(event) =>
                        updateNodeField("temperature", Number(event.target.value))
                      }
                    />
                    <span style={{ ...configLabelStyle, textAlign: "right" }}>
                      {Number(selectedNode.data.temperature ?? 0)}
                    </span>
                  </label>
                </>
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
          {canRunSelectedNode ? (
            <button
              type="button"
              onClick={handleRunSelectedNode}
              style={{
                minHeight: 36,
                padding: "8px 12px",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                color: "#dcfce7",
                background: "rgba(20,83,45,0.34)",
                border: "1px solid rgba(134,239,172,0.24)",
                borderRadius: 10,
                marginTop: 12,
                cursor: "pointer",
              }}
            >
              <PlayGlyph size={14} />
              执行当前节点
            </button>
          ) : null}
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
