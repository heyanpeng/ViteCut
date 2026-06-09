import type { ComponentType } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import type {
  WorkflowComposerNodeData,
  WorkflowComposerNodeKind,
} from "../workflowTypes";
import { PromptParamPanel } from "./PromptParamPanel";

export type NodeParamPanelProps = { data: WorkflowComposerNodeData };

export const PARAM_PANELS: Record<
  WorkflowComposerNodeKind,
  ComponentType<NodeParamPanelProps>
> = {
  prompt: PromptParamPanel,
  image: PromptParamPanel,
};

export function NodeParamPanelFrame({
  data,
  dragging,
}: NodeParamPanelProps & { dragging?: boolean }) {
  const Panel = PARAM_PANELS[data.kind];
  return (
    <NodeToolbar
      position={Position.Bottom}
      align="center"
      offset={20}
      isVisible={dragging ? false : undefined}
    >
      <div className="nodrag nopan">
        <Panel data={data} />
      </div>
    </NodeToolbar>
  );
}
