import { useEffect, useRef } from "react";
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

const HANDLE_SIZE_CSS = 56;
const MAGNET_FACTOR = 0.35;

export type PromptNodeCardProps = {
  data: WorkflowComposerNodeData;
  selected?: boolean;
  dragging?: boolean;
};

export function PromptNodeCard({ data, selected, dragging }: PromptNodeCardProps) {
  const handleHiddenStyle = dragging
    ? ({ visibility: "hidden" } as const)
    : undefined;
  const summary = typeof data.summary === "string" ? data.summary : "";
  const isEmpty = summary.length === 0;
  const cardClassName = selected
    ? "prompt-node__card prompt-node__card--selected"
    : "prompt-node__card";
  const rootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handles = Array.from(
      root.querySelectorAll<HTMLElement>(".prompt-node__handle")
    );
    if (handles.length === 0) return;

    const onMove = (event: MouseEvent) => {
      handles.forEach((handle) => {
        const rect = handle.getBoundingClientRect();
        if (rect.width === 0) return;
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = event.clientX - cx;
        const dy = event.clientY - cy;
        if (Math.abs(dx) < rect.width && Math.abs(dy) < rect.height) {
          const zoom = rect.width / HANDLE_SIZE_CSS;
          handle.style.setProperty("--mx", `${(dx * MAGNET_FACTOR) / zoom}px`);
          handle.style.setProperty("--my", `${(dy * MAGNET_FACTOR) / zoom}px`);
        } else {
          handle.style.setProperty("--mx", "0px");
          handle.style.setProperty("--my", "0px");
        }
      });
    };

    document.addEventListener("mousemove", onMove);
    return () => document.removeEventListener("mousemove", onMove);
  }, []);

  return (
    <div ref={rootRef} className="prompt-node">
      <div className="prompt-node__header">
        <TextGlyph size={14} />
        <span>Text</span>
      </div>

      <div className={cardClassName}>
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
        style={handleHiddenStyle}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        className="prompt-node__handle prompt-node__handle--out"
        style={handleHiddenStyle}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
    </div>
  );
}
