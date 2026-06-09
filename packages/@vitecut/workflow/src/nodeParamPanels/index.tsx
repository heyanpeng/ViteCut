import type { ComponentType } from "react";
import { NodeToolbar, Position } from "@xyflow/react";
import type { WorkflowComposerNodeKind } from "../workflowTypes";
import {
  PlaceholderParamPanel,
  type NodeParamPanelProps,
} from "./PlaceholderParamPanel";
import { PromptParamPanel } from "./PromptParamPanel";

export type { NodeParamPanelProps } from "./PlaceholderParamPanel";

export const PARAM_PANELS: Record<
  WorkflowComposerNodeKind,
  ComponentType<NodeParamPanelProps>
> = {
  prompt: PromptParamPanel,
  "reference-image": PlaceholderParamPanel,
  "image-reverse-prompt": PlaceholderParamPanel,
  "prompt-optimize": PlaceholderParamPanel,
  "image-params-adjust": PlaceholderParamPanel,
  "image-generate": PlaceholderParamPanel,
  "video-generate": PlaceholderParamPanel,
  "save-media": PlaceholderParamPanel,
  "insert-timeline": PlaceholderParamPanel,
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
