import { useEffect, useRef } from "react";
import { Handle, Position } from "@xyflow/react";
import { Plus } from "lucide-react";
import {
  BgSwapGlyph,
  FrameVideoGlyph,
  ImageGlyph,
  VideoGlyph,
} from "./workflowIcons";
import type { WorkflowComposerNodeData } from "./workflowTypes";
import "./ImageCard.css";

const HANDLE_SIZE_CSS = 56;
const MAGNET_FACTOR = 0.35;

export type ImageCardProps = {
  data: WorkflowComposerNodeData;
  selected?: boolean;
  dragging?: boolean;
};

export function ImageCard({ data, selected, dragging }: ImageCardProps) {
  const summary = typeof data.summary === "string" ? data.summary : "";
  const isEmpty = summary.length === 0;
  const cardClassName = selected
    ? "image-node__card image-node__card--selected"
    : "image-node__card";
  const rootRef = useRef<HTMLDivElement | null>(null);
  const handleHiddenStyle = dragging
    ? ({ visibility: "hidden" } as const)
    : undefined;

  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const handles = Array.from(
      root.querySelectorAll<HTMLElement>(".image-node__handle")
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
    <div ref={rootRef} className="image-node">
      <div className="image-node__header">
        <ImageGlyph size={14} />
        <span>Image</span>
      </div>

      <div className={cardClassName}>
        {isEmpty ? (
          <div>
            <div className="image-node__try-label">尝试:</div>
            <ul className="image-node__suggestions">
              <li>
                <ImageGlyph size={16} />
                <span>图生图</span>
              </li>
              <li>
                <VideoGlyph size={16} />
                <span>图生视频</span>
              </li>
              <li>
                <BgSwapGlyph size={16} />
                <span>图片换背景</span>
              </li>
              <li>
                <FrameVideoGlyph size={16} />
                <span>首帧图生视频</span>
              </li>
            </ul>
          </div>
        ) : (
          <p className="image-node__summary">{summary}</p>
        )}
      </div>

      <Handle
        type="target"
        position={Position.Left}
        className="image-node__handle image-node__handle--in"
        style={handleHiddenStyle}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
      <Handle
        type="source"
        position={Position.Right}
        className="image-node__handle image-node__handle--out"
        style={handleHiddenStyle}
      >
        <Plus size={14} strokeWidth={1.8} />
      </Handle>
    </div>
  );
}
