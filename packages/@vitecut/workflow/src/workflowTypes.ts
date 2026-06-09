import type { Edge, Node } from "@xyflow/react";

export type WorkflowComposerNodeKind = "prompt" | "image";

export interface WorkflowComposerNodeData extends Record<string, unknown> {
  label: string;
  kind: WorkflowComposerNodeKind;
  summary: string;
  accent: string;
  referenceImageUrls?: string[];
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
  onShowToast?: (message: string) => void;
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
