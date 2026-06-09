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
  useReactFlow,
  type Connection,
  type Edge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import {
  ALLOWED_CONNECTIONS,
  EDGE_STYLE_OPTIONS,
  INPUT_NODE_KINDS,
  NODE_GROUPS,
  NODE_LIBRARY,
  OUTPUT_NODE_KINDS,
} from "./workflowConfig";
import { nodeTypes } from "./WorkflowNodeCard";
import { PromptBezierEdge, PromptSmoothStepEdge } from "./PromptEdge";
import { PromptConnectionLine } from "./PromptConnectionLine";
import {
  BgSwapGlyph,
  CursorGlyph,
  DeleteGlyph,
  ExitGlyph,
  FrameVideoGlyph,
  MyFlowGlyph,
  PlayGlyph,
  SaveGlyph,
  ScissorsGlyph,
  SidebarGlyph,
  TextVideoGlyph,
} from "./workflowIcons";
import { WorkflowQuickAddMenu } from "./WorkflowQuickAddMenu";
import {
  WorkflowEmbeddedToast,
  useEmbeddedToast,
} from "./WorkflowEmbeddedToast";
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
  WorkflowComposerInitialWorkflow,
  WorkflowComposerNodeKind,
  WorkflowComposerProps,
  WorkflowFlowNode,
} from "./workflowTypes";

const edgeTypes = {
  default: PromptBezierEdge,
  smoothstep: PromptSmoothStepEdge,
};

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
  const rootRef = useRef<HTMLDivElement | null>(null);
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

  const [workflowName, setWorkflowName] = useState("未命名工作流");
  const [flowNodes, setFlowNodes, onNodesChange] = useNodesState<WorkflowFlowNode>(
    []
  );
  const [flowEdges, setFlowEdges, onEdgesChange] = useEdgesState<Edge>([]);
  const reactFlowInstance = useReactFlow();
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

  useEffect(() => {
    setWorkflowName(initialWorkflow?.name ?? "未命名工作流");
    setFlowNodes(initialWorkflow?.nodes ?? []);
    setFlowEdges(initialWorkflow?.edges ?? []);
    setSelectedNodeId("");
    setSelectedEdgeId("");
    setSelectedEdgeAnchor(null);
  }, [initialWorkflow, setFlowEdges, setFlowNodes]);

  const nodeById = useMemo(
    () => new Map(flowNodes.map((node) => [node.id, node])),
    [flowNodes]
  );

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

  const addNodeFromLibrary = useCallback(
    (
      nodeData: WorkflowComposerNodeData,
      position?: { x: number; y: number }
    ) => {
      const isInputKind =
        nodeData.kind === "prompt" || nodeData.kind === "image";
      const normalizedData: WorkflowComposerNodeData = isInputKind
        ? { ...nodeData, summary: "" }
        : { ...nodeData };
      const newNode: WorkflowFlowNode = {
        id: createNodeId(nodeData.kind),
        type: "workflowNode",
        position: position ?? {
          x: 280 + flowNodes.length * 18,
          y: 120 + flowNodes.length * 16,
        },
        data: normalizedData,
      };
      setFlowNodes((current) => [...current, newNode]);
      setSelectedNodeId(newNode.id);
      setActiveSidebarMenu(null);
    },
    [createNodeId, flowNodes.length, setFlowNodes]
  );

  const handleQuickPickNode = useCallback(
    (kind: WorkflowComposerNodeKind) => {
      if (!quickAddAnchor) return;
      const rect = rootRef.current?.getBoundingClientRect();
      if (!rect) return;
      const template = NODE_LIBRARY.find((entry) => entry.kind === kind);
      if (!template) return;
      const flowPosition = reactFlowInstance.screenToFlowPosition({
        x: quickAddAnchor.x + rect.left,
        y: quickAddAnchor.y + rect.top,
      });
      addNodeFromLibrary({ ...template }, flowPosition);
      setQuickAddAnchor(null);
    },
    [addNodeFromLibrary, quickAddAnchor, reactFlowInstance]
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

  return (
    <div
      ref={rootRef}
      className="vitecut-workflow"
      style={{
        height: "100%",
        position: "relative",
      }}
      onDoubleClick={handleCanvasDoubleClick}
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
        {onDeleteWorkflow ? (
          <button
            type="button"
            onClick={onDeleteWorkflow}
            disabled={deletingWorkflow}
            style={{
              minHeight: 36,
              padding: "8px 14px",
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              borderRadius: 10,
              border: "1px solid rgba(248,113,113,0.38)",
              background: "rgba(127,29,29,0.45)",
              color: "#fecaca",
              fontSize: 13,
              fontWeight: 600,
              cursor: deletingWorkflow ? "not-allowed" : "pointer",
              opacity: deletingWorkflow ? 0.75 : 1,
            }}
          >
            <DeleteGlyph size={14} />
            {deletingWorkflow ? "删除中..." : "删除工作流"}
          </button>
        ) : null}
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
          disabled={savingWorkflow}
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
            cursor: savingWorkflow ? "not-allowed" : "pointer",
            opacity: savingWorkflow ? 0.75 : 1,
          }}
        >
          <SaveGlyph size={14} />
          {savingWorkflow ? "保存中..." : "保存"}
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
                                addNodeFromLibrary(item);
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
          edgeTypes={edgeTypes}
          connectionLineComponent={PromptConnectionLine}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={handleConnect}
          onNodeClick={(_, node) => {
            setQuickAddAnchor(null);
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
            setSelectedNodeId(node.id);
          }}
          onNodeDragStart={() => {
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
          }}
          onEdgeClick={(event, edge) => {
            setQuickAddAnchor(null);
            const rootRect = rootRef.current?.getBoundingClientRect();
            setSelectedNodeId("");
            setSelectedEdgeId(edge.id);
            setSelectedEdgeAnchor({
              x: rootRect ? event.clientX - rootRect.left : event.clientX,
              y: rootRect ? event.clientY - rootRect.top : event.clientY,
            });
          }}
          onPaneClick={() => {
            setQuickAddAnchor(null);
            setSelectedNodeId("");
            setSelectedEdgeId("");
            setSelectedEdgeAnchor(null);
          }}
          onMoveStart={() => {
            setQuickAddAnchor(null);
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
        {flowNodes.length === 0 && !quickAddAnchor ? (
          <div className="workflow-empty-state" aria-live="polite">
            <div className="workflow-empty-state__hint">
              <span className="workflow-empty-state__hint-chip">
                <span className="workflow-empty-state__cursor" aria-hidden>
                  <CursorGlyph size={14} />
                </span>
                <span>双击屏幕</span>
              </span>
              <span className="workflow-empty-state__hint-text">画布自由生成</span>
            </div>

            <div className="workflow-empty-state__quick">
              <button
                type="button"
                className="workflow-empty-state__pill"
                onClick={() => setActiveSidebarMenu("nodes")}
              >
                <span className="workflow-empty-state__pill-icon" aria-hidden>
                  <TextVideoGlyph size={18} />
                </span>
                <span>文字生视频</span>
              </button>

              <button
                type="button"
                className="workflow-empty-state__pill"
                onClick={() => setActiveSidebarMenu("nodes")}
              >
                <span className="workflow-empty-state__pill-icon" aria-hidden>
                  <BgSwapGlyph size={18} />
                </span>
                <span>图片换背景</span>
              </button>

              <button
                type="button"
                className="workflow-empty-state__pill"
                onClick={() => setActiveSidebarMenu("nodes")}
              >
                <span className="workflow-empty-state__pill-icon" aria-hidden>
                  <FrameVideoGlyph size={18} />
                </span>
                <span>首尾帧生视频</span>
              </button>

              <button
                type="button"
                className="workflow-empty-state__pill"
                onClick={() => setActiveSidebarMenu("workflow")}
              >
                <span className="workflow-empty-state__pill-icon" aria-hidden>
                  <MyFlowGlyph size={18} />
                </span>
                <span>我的工作流</span>
              </button>
            </div>
          </div>
        ) : null}
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

      <WorkflowQuickAddMenu
        open={Boolean(quickAddAnchor)}
        anchor={quickAddAnchor}
        containerSize={containerSize}
        onPickNode={handleQuickPickNode}
        onPickSoon={(label) => showToast(`${label}即将上线`)}
        onClose={() => setQuickAddAnchor(null)}
      />
      <WorkflowEmbeddedToast toast={embeddedToast} />
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
