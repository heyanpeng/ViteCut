import type { WorkflowComposerNodeData } from "../workflowTypes";
import "./shared.css";

export type NodeParamPanelProps = { data: WorkflowComposerNodeData };

export function PlaceholderParamPanel({ data }: NodeParamPanelProps) {
  return (
    <div className="node-param-panel node-param-panel--placeholder">
      "{data.label}" 暂无可配置参数（即将上线）
    </div>
  );
}
