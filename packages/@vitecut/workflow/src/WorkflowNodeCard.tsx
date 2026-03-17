import { memo } from "react";
import { Handle, Position } from "@xyflow/react";
import {
  IMAGE_MODEL_OPTIONS,
  VIDEO_MODEL_OPTIONS,
} from "./workflowConfig";
import type { WorkflowComposerNodeData } from "./workflowTypes";

function WorkflowNodeCard({
  data,
  selected,
}: {
  data: WorkflowComposerNodeData;
  selected?: boolean;
}) {
  const borderColor = selected ? `${data.accent}cc` : `${data.accent}55`;
  const imageModelName =
    IMAGE_MODEL_OPTIONS.find((item) => item.id === data.model)?.name ??
    data.model?.toString() ??
    "";
  const videoModelName =
    VIDEO_MODEL_OPTIONS.find((item) => item.id === data.model)?.name ??
    data.model?.toString() ??
    "";
  const imageReferencePreviewUrls =
    data.kind === "image-generate" && Array.isArray(data.referenceImageUrls)
      ? data.referenceImageUrls.slice(0, 4)
      : [];
  const videoFramePreviewUrls =
    data.kind === "video-generate"
      ? [
          data.videoStartFrameUrl?.toString() ?? "",
          data.videoEndFrameUrl?.toString() ?? "",
        ].filter((item) => item.length > 0)
      : [];
  const isGenerateNode =
    data.kind === "image-generate" || data.kind === "video-generate";
  const hasReverseImage =
    data.kind === "image-reverse-prompt" &&
    typeof data.reverseImageUrl === "string" &&
    data.reverseImageUrl.length > 0;

  return (
    <div
      style={{
        minWidth: 196,
        maxWidth: 240,
        padding: 14,
        borderRadius: 16,
        border: `1px solid ${borderColor}`,
        background:
          "linear-gradient(180deg, rgba(20,24,34,0.96) 0%, rgba(10,12,18,0.98) 100%)",
        boxShadow: "none",
        transition: "border-color 160ms ease",
        color: "#f6f7fb",
        overflow: "hidden",
      }}
    >
      <Handle
        type="target"
        position={Position.Left}
        style={{
          width: 10,
          height: 10,
          border: "2px solid rgba(255,255,255,0.82)",
          background: data.accent,
        }}
      />
      <div
        style={{
          fontSize: 15,
          fontWeight: 700,
          lineHeight: 1.2,
          marginBottom: 8,
          overflowWrap: "anywhere",
          wordBreak: "break-word",
        }}
      >
        {data.label}
      </div>
      {isGenerateNode ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.7)",
            marginBottom: 8,
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {data.summary}
        </div>
      ) : null}
      {data.kind === "image-generate" && imageReferencePreviewUrls.length > 0 ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
            gap: 6,
            marginBottom: 8,
          }}
        >
          {imageReferencePreviewUrls.map((url, index) => (
            <div
              key={`${url.slice(0, 24)}-${index}`}
              style={{
                borderRadius: 6,
                overflow: "hidden",
                border: "1px solid rgba(255,255,255,0.12)",
                background: "rgba(255,255,255,0.03)",
              }}
            >
              <img
                src={url}
                alt={`参考图 ${index + 1}`}
                style={{
                  width: "100%",
                  height: 28,
                  display: "block",
                  objectFit: "cover",
                }}
              />
            </div>
          ))}
        </div>
      ) : null}
      {hasReverseImage ? (
        <div
          style={{
            borderRadius: 10,
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.12)",
            background: "rgba(255,255,255,0.02)",
          }}
        >
          <img
            src={data.reverseImageUrl}
            alt="反推输入图"
            style={{
              width: "100%",
              height: 112,
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>
      ) : data.kind === "image-reverse-prompt" ? (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.52)",
          }}
        >
          暂未上传图片
        </div>
      ) : data.kind === "image-generate" ? (
        <div style={{ display: "grid", gap: 4 }}>
          {[
            { key: "模型", value: imageModelName || "-" },
            { key: "比例", value: data.ratio?.toString() ?? "smart" },
            { key: "分辨率", value: data.resolution?.toString() ?? "2k" },
            {
              key: "尺寸",
              value: `${Number(data.width ?? 3024)}×${Number(data.height ?? 1296)}`,
            },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.42)" }}>{item.key}</span>
              <span
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  textAlign: "right",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : data.kind === "video-generate" ? (
        <div style={{ display: "grid", gap: 4 }}>
          {videoFramePreviewUrls.length > 0 ? (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(2, minmax(0, 1fr))",
                gap: 6,
                marginBottom: 4,
              }}
            >
              {[
                { key: "首", url: data.videoStartFrameUrl?.toString() ?? "" },
                { key: "尾", url: data.videoEndFrameUrl?.toString() ?? "" },
              ].map((item) =>
                item.url ? (
                  <div
                    key={`${item.key}-${item.url.slice(0, 20)}`}
                    style={{
                      borderRadius: 6,
                      overflow: "hidden",
                      border: "1px solid rgba(255,255,255,0.12)",
                      background: "rgba(255,255,255,0.03)",
                    }}
                  >
                    <img
                      src={item.url}
                      alt={`${item.key}帧`}
                      style={{
                        width: "100%",
                        height: 28,
                        display: "block",
                        objectFit: "cover",
                      }}
                    />
                  </div>
                ) : (
                  <div
                    key={`${item.key}-empty`}
                    style={{
                      borderRadius: 6,
                      border: "1px dashed rgba(255,255,255,0.16)",
                      color: "rgba(255,255,255,0.42)",
                      fontSize: 10,
                      minHeight: 28,
                      display: "grid",
                      placeItems: "center",
                    }}
                  >
                    {item.key}帧
                  </div>
                )
              )}
            </div>
          ) : null}
          {[
            { key: "模型", value: videoModelName || "-" },
            { key: "比例", value: data.ratio?.toString() ?? "16:9" },
            { key: "分辨率", value: data.resolution?.toString() ?? "2k" },
            { key: "时长", value: `${Number(data.duration ?? 5)}s` },
          ].map((item) => (
            <div
              key={item.key}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 8,
                fontSize: 10.5,
                color: "rgba(255,255,255,0.6)",
              }}
            >
              <span style={{ color: "rgba(255,255,255,0.42)" }}>{item.key}</span>
              <span
                style={{
                  overflowWrap: "anywhere",
                  wordBreak: "break-word",
                  textAlign: "right",
                }}
              >
                {item.value}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div
          style={{
            fontSize: 12,
            lineHeight: 1.45,
            color: "rgba(255,255,255,0.7)",
            overflowWrap: "anywhere",
            wordBreak: "break-word",
          }}
        >
          {data.summary}
        </div>
      )}
      <Handle
        type="source"
        position={Position.Right}
        style={{
          width: 10,
          height: 10,
          border: "2px solid rgba(255,255,255,0.82)",
          background: data.accent,
        }}
      />
    </div>
  );
}

const WorkflowNode = memo(WorkflowNodeCard);

export const nodeTypes = {
  workflowNode: WorkflowNode,
};
