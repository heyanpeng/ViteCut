import { memo } from "react";
import { PromptNodeCard } from "./PromptNodeCard";
import { ImageCard } from "./ImageCard";
import { NodeParamPanelFrame } from "./nodeParamPanels";
import type { WorkflowComposerNodeData } from "./workflowTypes";

function WorkflowNodeCard({
  data,
  selected,
  dragging,
}: {
  data: WorkflowComposerNodeData;
  selected?: boolean;
  dragging?: boolean;
}) {
  if (data.kind === "image") {
    return (
      <>
        <ImageCard data={data} selected={selected} dragging={dragging} />
        <NodeParamPanelFrame data={data} dragging={dragging} />
      </>
    );
  }
  return (
    <>
      <PromptNodeCard data={data} selected={selected} dragging={dragging} />
      <NodeParamPanelFrame data={data} dragging={dragging} />
    </>
  );
}

const WorkflowNode = memo(WorkflowNodeCard);

export const nodeTypes = {
  workflowNode: WorkflowNode,
};
