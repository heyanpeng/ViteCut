import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import {
  PenGlyph,
  ScanTextGlyph,
  TextGlyph,
  UploadGlyph,
  VideoGlyph,
} from "./workflowIcons";
import type { WorkflowComposerNodeData } from "./workflowTypes";
import "./PromptNodeCard.css";

export type PromptNodeCardProps = {
  data: WorkflowComposerNodeData;
  selected?: boolean;
};

export function PromptNodeCard({ data }: PromptNodeCardProps) {
  const summary = typeof data.summary === "string" ? data.summary : "";
  const isEmpty = summary.length === 0;

  return (
    <div className="prompt-node">
      <div className="prompt-node__header">
        <TextGlyph size={14} />
        <span>Text</span>
      </div>

      <div className="prompt-node__card">
        {isEmpty ? (
          <div>
            <div className="prompt-node__try-label">尝试:</div>
            <ul className="prompt-node__suggestions">
              <li>
                <PenGlyph size={16} />
                <span>自己编写内容</span>
              </li>
              <li>
                <UploadGlyph size={16} />
                <span>上传文档解析文本</span>
              </li>
              <li>
                <VideoGlyph size={16} />
                <span>文字生视频</span>
              </li>
              <li>
                <ScanTextGlyph size={16} />
                <span>图片反推提示词</span>
              </li>
            </ul>
          </div>
        ) : (
          <p className="prompt-node__summary">{summary}</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="prompt-node__handle prompt-node__handle--in"
        style={{ background: "transparent", border: "none" }}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        className="prompt-node__handle prompt-node__handle--out"
        style={{ background: "transparent", border: "none" }}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
    </div>
  );
}
