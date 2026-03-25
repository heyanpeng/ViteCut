import type { Edge, Node } from "@xyflow/react";

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
  brightness?: number;
  contrast?: number;
  saturation?: number;
  sharpness?: number;
  temperature?: number;
  width?: number;
  height?: number;
  dimensionsLinked?: boolean;
  outputTarget?: string;
  timelineInsertAt?: string;
}

export type WorkflowFlowNode = Node<WorkflowComposerNodeData, "workflowNode">;
export type WorkflowEdgeStyle = "bezier" | "orthogonal";
export type WorkflowSidebarMenu = "nodes" | "workflow";

export interface WorkflowComposerInitialWorkflow {
  name: string;
  nodes: WorkflowFlowNode[];
  edges: Edge[];
}

export interface WorkflowComposerProps {
  title?: string;
  subtitle?: string;
  onExit?: () => void;
  onDeleteWorkflow?: () => void;
  deletingWorkflow?: boolean;
  savingWorkflow?: boolean;
  initialWorkflow?: WorkflowComposerInitialWorkflow;
  onSave?: (payload: {
    name: string;
    nodes: WorkflowFlowNode[];
    edges: Edge[];
  }) => void;
}

export interface WorkflowEdgeStyleOption {
  id: WorkflowEdgeStyle;
  label: string;
  desc: string;
  edgeType: "default" | "smoothstep";
}

export interface WorkflowNodeGroup {
  title: string;
  kinds: WorkflowComposerNodeKind[];
}
