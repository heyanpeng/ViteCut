import { useState, useRef, useEffect } from "react";
import { Select, Popover } from "radix-ui";
import {
  Image,
  Video,
  ChevronDown,
  Check,
  Link2,
  Link2Off,
  Diamond,
  Plus,
  Monitor,
  Square,
  Star,
  Sparkles,
  Box,
  ArrowLeftRight,
  X,
} from "lucide-react";
import "./AIPanel.css";

// 创作类型
const CREATION_TYPES = [
  { id: "image", label: "图片生成", icon: Image },
  { id: "video", label: "视频生成", icon: Video },
];

// 图片生成模型
const IMAGE_MODELS = [
  {
    id: "5.0-lite",
    name: "图片 5.0 Lite",
    desc: "指令响应更精准，生成效果更智能",
    isNew: true,
  },
  {
    id: "4.6",
    name: "图片 4.6",
    desc: "人像一致性保持更好，性价比更高",
    isNew: true,
  },
  {
    id: "4.5",
    name: "图片 4.5",
    desc: "强化一致性、风格与图文响应",
    isNew: false,
  },
  {
    id: "4.1",
    name: "图片 4.1",
    desc: "更专业的创意、美学和一致性保持",
    isNew: false,
  },
  {
    id: "4.0",
    name: "图片 4.0",
    desc: "支持多参考图、系列组图生成",
    isNew: false,
  },
  {
    id: "3.1",
    name: "图片 3.1",
    desc: "丰富的美学多样性，画面更鲜明生动",
    isNew: false,
  },
  {
    id: "3.0",
    name: "图片 3.0",
    desc: "影视质感，文字更准，直出 2k 高清图",
    isNew: false,
  },
];

// 视频生成模型
const VIDEO_MODELS = [
  {
    id: "seedance-2.0-fast",
    name: "Seedance 2.0 Fast",
    desc: "高性价比,音视文图均可参考(暂不支持真人人脸)",
    isNew: true,
  },
  {
    id: "seedance-2.0",
    name: "Seedance 2.0",
    desc: "全能王者,音视文图均可参考(暂不支持真人人脸)",
    isNew: true,
  },
  {
    id: "3.5-pro",
    name: "视频 3.5 Pro",
    desc: "音画同出,全新体验",
    isNew: true,
  },
  {
    id: "3.0-pro",
    name: "视频 3.0 Pro",
    desc: "效果最佳,画质超清",
    isNew: false,
    isStar: true,
  },
  {
    id: "3.0-fast",
    name: "视频 3.0 Fast",
    desc: "Pro级表现,加量不加价",
    isNew: false,
  },
  {
    id: "3.0",
    name: "视频 3.0",
    desc: "精准响应,支持多镜头和运镜",
    isNew: false,
  },
];

// 比例预设（带图标类型）
const ASPECT_RATIOS = [
  { id: "smart", label: "智能", iconType: "smart" },
  { id: "21:9", label: "21:9", iconType: "21:9" },
  { id: "16:9", label: "16:9", iconType: "16:9" },
  { id: "3:2", label: "3:2", iconType: "3:2" },
  { id: "4:3", label: "4:3", iconType: "4:3" },
  { id: "1:1", label: "1:1", iconType: "1:1" },
  { id: "3:4", label: "3:4", iconType: "3:4" },
  { id: "2:3", label: "2:3", iconType: "2:3" },
  { id: "9:16", label: "9:16", iconType: "9:16" },
];

// 分辨率预设
const RESOLUTIONS = [
  { id: "2k", label: "高清 2K", hasBadge: false },
  { id: "4k", label: "超清 4K", hasBadge: false },
];

function RatioIcon({ type }: { type: string }) {
  const isSmart = type === "smart";
  if (isSmart) {
    return (
      <span className="ai-ratio-icon ai-ratio-icon--smart">
        <Square size={14} strokeWidth={2} />
        <span className="ai-ratio-icon__arrow">⌃</span>
      </span>
    );
  }
  const [w, h] = type.split(":").map(Number);
  const isPortrait = h > w;
  const maxSize = 18;
  const ratio = w / h;
  const frameW = isPortrait ? maxSize * ratio : maxSize;
  const frameH = isPortrait ? maxSize : maxSize / ratio;
  return (
    <span
      className="ai-ratio-icon ai-ratio-icon--frame"
      style={{
        width: Math.max(Math.min(frameW, 24), 10),
        height: Math.max(Math.min(frameH, 24), 10),
      }}
    />
  );
}

function FilePreviewImage({
  file,
  className,
}: {
  file: File;
  className?: string;
}) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    const u = URL.createObjectURL(file);
    setUrl(u);
    return () => {
      URL.revokeObjectURL(u);
    };
  }, [file]);
  if (!url) {
    return null;
  }
  return <img src={url} alt="" className={className} />;
}

function ImageGenPanel() {
  const [creationType, setCreationType] = useState("image");
  const [selectedModel, setSelectedModel] = useState("4.1");
  const [selectedVideoModel, setSelectedVideoModel] = useState("seedance-2.0");
  const [startFrame, setStartFrame] = useState<File | null>(null);
  const [endFrame, setEndFrame] = useState<File | null>(null);
  const startFrameRef = useRef<HTMLInputElement>(null);
  const endFrameRef = useRef<HTMLInputElement>(null);
  const [aspectRatio, setAspectRatio] = useState("smart");
  const [resolution, setResolution] = useState("2k");
  const [width, setWidth] = useState(3024);
  const [height, setHeight] = useState(1296);
  const [dimensionsLinked, setDimensionsLinked] = useState(true);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [prompt, setPrompt] = useState("");
  const refInputRef = useRef<HTMLInputElement>(null);

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files?.length) {
      setReferenceFiles((prev) => {
        const next = [...prev, ...Array.from(files)];
        return next.slice(0, 4);
      });
    }
    e.target.value = "";
  };

  const handleWidthChange = (v: number) => {
    setWidth(v);
    if (dimensionsLinked && aspectRatio !== "smart") {
      const parts = aspectRatio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        setHeight(Math.round((v * b) / a));
      }
    }
  };

  const handleHeightChange = (v: number) => {
    setHeight(v);
    if (dimensionsLinked && aspectRatio !== "smart") {
      const parts = aspectRatio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        setWidth(Math.round((v * a) / b));
      }
    }
  };

  const handleAspectRatioChange = (ratio: string) => {
    setAspectRatio(ratio);
    if (ratio !== "smart" && dimensionsLinked) {
      const parts = ratio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        const base = resolution === "4k" ? 2048 : 1024;
        if (a >= b) {
          setWidth(Math.round((base * a) / b));
          setHeight(base);
        } else {
          setWidth(base);
          setHeight(Math.round((base * b) / a));
        }
      }
    }
  };

  const isImageMode = creationType === "image";

  return (
    <div className="ai-image-gen">
      {/* 顶部：参考图 + 提示词（或占位） */}
      <div
        className="ai-prompt-ref-area"
        onClick={(e) => {
          const target = e.target as HTMLElement;
          if (target.closest(".ai-ref-delete")) return;
          if (isImageMode) {
            if (
              target.closest(".ai-ref-add-btn") ||
              target.closest(".ai-ref-images-list")
            ) {
              refInputRef.current?.click();
            }
          } else if (target.closest(".ai-ref-block--start")) {
            startFrameRef.current?.click();
          } else if (target.closest(".ai-ref-block--end")) {
            endFrameRef.current?.click();
          }
        }}
        onDragOver={(e) => {
          e.preventDefault();
          e.stopPropagation();
          e.dataTransfer.dropEffect = "copy";
        }}
        onDrop={(e) => {
          e.preventDefault();
          e.stopPropagation();
          const files = Array.from(e.dataTransfer.files).filter((f) =>
            f.type.startsWith("image/"),
          );
          if (!files.length) return;
          if (isImageMode) {
            setReferenceFiles((prev) => {
              const next = [...prev, ...files];
              return next.slice(0, 4);
            });
          } else {
            const el = document.elementFromPoint(e.clientX, e.clientY);
            if (el?.closest(".ai-ref-block--start")) {
              setStartFrame(files[0]);
            } else if (el?.closest(".ai-ref-block--end")) {
              setEndFrame(files[0]);
            }
          }
        }}
      >
        <input
          ref={refInputRef}
          type="file"
          accept="image/*"
          multiple
          style={{ display: "none" }}
          onChange={handleRefFileChange}
        />
        <input
          ref={startFrameRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setStartFrame(f ? f : null);
            e.target.value = "";
          }}
        />
        <input
          ref={endFrameRef}
          type="file"
          accept="image/*"
          style={{ display: "none" }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            setEndFrame(f ? f : null);
            e.target.value = "";
          }}
        />
        {isImageMode ? (
          <>
            <textarea
              className="ai-prompt-input"
              placeholder="请描述你想生成的图片"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
            <div className="ai-ref-block ai-ref-block--images">
              <div className="ai-ref-images-row">
                <div className="ai-ref-images-list">
                  {referenceFiles.map((f, i) => (
                    <div
                      key={`${String(f.lastModified)}-${i}`}
                      className="ai-ref-preview-wrap ai-ref-preview-wrap--ratio"
                    >
                      <FilePreviewImage
                        file={f}
                        className="ai-ref-preview-img ai-ref-preview-img--ratio"
                      />
                      <button
                        type="button"
                        className="ai-ref-delete"
                        onClick={(e) => {
                          e.stopPropagation();
                          setReferenceFiles((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          );
                        }}
                        aria-label="删除"
                      >
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                  {referenceFiles.length < 4 && (
                    <button
                      type="button"
                      className="ai-ref-add-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        refInputRef.current?.click();
                      }}
                      aria-label="添加参考图"
                    >
                      <Plus size={24} strokeWidth={1.5} />
                      <span>添加</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          </>
        ) : creationType === "video" ? (
          <>
            <textarea
              className="ai-prompt-input"
              placeholder="输入文字，描述你想创作的画面内容、运动方式等。例如：小雨滴从云朵上跳下来。"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={4}
            />
            <div className="ai-video-frames">
              <div className="ai-ref-block ai-ref-block--start">
                {startFrame ? (
                  <div className="ai-ref-preview-wrap ai-ref-preview-wrap--frame">
                    <FilePreviewImage
                      file={startFrame}
                      className="ai-ref-preview-img ai-ref-preview-img--frame"
                    />
                    <button
                      type="button"
                      className="ai-ref-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStartFrame(null);
                      }}
                      aria-label="删除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Plus
                      size={28}
                      className="ai-ref-block__icon"
                      strokeWidth={1.5}
                    />
                    <span className="ai-ref-block__label">首帧</span>
                  </>
                )}
              </div>
              <button
                type="button"
                className="ai-video-frames__arrow"
                onClick={() => {
                  setStartFrame(endFrame);
                  setEndFrame(startFrame);
                }}
                aria-label="交换首尾帧"
              >
                <ArrowLeftRight size={20} aria-hidden />
              </button>
              <div className="ai-ref-block ai-ref-block--end">
                {endFrame ? (
                  <div className="ai-ref-preview-wrap ai-ref-preview-wrap--frame">
                    <FilePreviewImage
                      file={endFrame}
                      className="ai-ref-preview-img ai-ref-preview-img--frame"
                    />
                    <button
                      type="button"
                      className="ai-ref-delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEndFrame(null);
                      }}
                      aria-label="删除"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <>
                    <Plus
                      size={28}
                      className="ai-ref-block__icon"
                      strokeWidth={1.5}
                    />
                    <span className="ai-ref-block__label">尾帧</span>
                  </>
                )}
              </div>
            </div>
          </>
        ) : (
          <div className="ai-prompt-placeholder">
            <p>
              {CREATION_TYPES.find((t) => t.id === creationType)?.label}{" "}
              功能即将推出
            </p>
          </div>
        )}
      </div>

      {/* 底部：控制栏 */}
      <div className="ai-control-bar">
        <div className="ai-control-bar__row">
          <div className="ai-control-bar__mode-model">
            <div className="ai-control-bar__mode-model__item ai-control-bar__mode-model__item--55">
              <Select.Root value={creationType} onValueChange={setCreationType}>
                <Select.Trigger
                  className="ai-control-btn ai-control-btn--primary ai-control-btn--flex"
                  aria-label="创作类型"
                >
                  {(() => {
                    const CtIcon =
                      CREATION_TYPES.find((t) => t.id === creationType)?.icon ??
                      Image;
                    return (
                      <CtIcon
                        size={16}
                        className="ai-control-btn__icon"
                        aria-hidden
                      />
                    );
                  })()}
                  <Select.Value />
                  <Select.Icon>
                    <ChevronDown size={14} aria-hidden />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="ai-model-select-content ai-creation-type-content"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.Viewport className="ai-creation-type-viewport">
                      {CREATION_TYPES.map((t) => {
                        const TIcon = t.icon;
                        return (
                          <Select.Item
                            key={t.id}
                            value={t.id}
                            className="ai-creation-type-item"
                            textValue={t.label}
                          >
                            <TIcon
                              size={16}
                              className="ai-creation-type-item__icon"
                            />
                            <Select.ItemText>{t.label}</Select.ItemText>
                            <Select.ItemIndicator>
                              <Check size={16} />
                            </Select.ItemIndicator>
                          </Select.Item>
                        );
                      })}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
            <div className="ai-control-bar__mode-model__item ai-control-bar__mode-model__item--45">
              <Select.Root
                value={
                  creationType === "video" ? selectedVideoModel : selectedModel
                }
                onValueChange={
                  creationType === "video"
                    ? setSelectedVideoModel
                    : setSelectedModel
                }
              >
                <Select.Trigger
                  className="ai-control-btn ai-control-btn--flex"
                  aria-label="选择模型"
                >
                  <Box size={14} className="ai-control-btn__icon" />
                  <Select.Value placeholder="选择模型…" />
                  <Select.Icon>
                    <ChevronDown size={12} aria-hidden />
                  </Select.Icon>
                </Select.Trigger>
                <Select.Portal>
                  <Select.Content
                    className="ai-model-select-content"
                    position="popper"
                    sideOffset={4}
                  >
                    <Select.Viewport className="ai-model-select-viewport">
                      {(creationType === "video"
                        ? VIDEO_MODELS
                        : IMAGE_MODELS
                      ).map((m) => (
                        <Select.Item
                          key={m.id}
                          value={m.id}
                          className="ai-model-select-item"
                          textValue={m.name}
                        >
                          <div className="ai-model-select-item__main">
                            <Select.ItemText className="ai-model-select-item__name">
                              {m.name}
                              {m.isNew && (
                                <span className="ai-model-select-item__new">
                                  New
                                </span>
                              )}
                              {"isStar" in m &&
                                (m as { isStar?: boolean }).isStar && (
                                  <Star
                                    size={12}
                                    className="ai-model-select-item__star"
                                  />
                                )}
                            </Select.ItemText>
                            <span className="ai-model-select-item__desc">
                              {m.desc}
                            </span>
                          </div>
                          <Select.ItemIndicator>
                            <Check size={16} />
                          </Select.ItemIndicator>
                        </Select.Item>
                      ))}
                    </Select.Viewport>
                  </Select.Content>
                </Select.Portal>
              </Select.Root>
            </div>
          </div>
        </div>

        <div className="ai-control-bar__row ai-control-bar__row--size">
          <Popover.Root>
            <Popover.Trigger asChild>
              <button
                type="button"
                className="ai-control-btn ai-control-btn--full"
                aria-label="尺寸与分辨率"
              >
                <Monitor size={14} className="ai-control-btn__icon" />
                <span>
                  {width}:{height} |{" "}
                  {resolution === "2k" ? "高清 2K" : "超清 4K"}
                </span>
                <ChevronDown size={12} className="ai-control-btn__chevron" />
              </button>
            </Popover.Trigger>
            <Popover.Portal>
              <Popover.Content
                className="ai-size-popover"
                side="top"
                sideOffset={8}
                align="start"
              >
                <div className="ai-size-popover__section">
                  <h4 className="ai-size-popover__title">选择比例</h4>
                  <div className="ai-ratio-row">
                    {ASPECT_RATIOS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`ai-ratio-btn ${aspectRatio === r.id ? "ai-ratio-btn--selected" : ""}`}
                        onClick={() => handleAspectRatioChange(r.id)}
                      >
                        <RatioIcon type={r.iconType} />
                        <span className="ai-ratio-btn__label">{r.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-size-popover__section">
                  <h4 className="ai-size-popover__title">选择分辨率</h4>
                  <div className="ai-resolution-row">
                    {RESOLUTIONS.map((r) => (
                      <button
                        key={r.id}
                        type="button"
                        className={`ai-resolution-btn ${resolution === r.id ? "ai-resolution-btn--selected" : ""}`}
                        onClick={() => setResolution(r.id)}
                      >
                        {r.label}
                        {r.hasBadge && (
                          <Diamond
                            size={10}
                            className="ai-resolution-btn__badge"
                          />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="ai-size-popover__section">
                  <h4 className="ai-size-popover__title">尺寸</h4>
                  <div className="ai-dimensions">
                    <span className="ai-dimensions__label">W</span>
                    <input
                      type="number"
                      className="ai-dimensions__input"
                      value={width}
                      onChange={(e) =>
                        handleWidthChange(Number(e.target.value) || 0)
                      }
                      min={1}
                    />
                    <button
                      type="button"
                      className="ai-dimensions__link"
                      title={dimensionsLinked ? "解除锁定" : "锁定比例"}
                      onClick={() => setDimensionsLinked((v) => !v)}
                    >
                      {dimensionsLinked ? (
                        <Link2 size={14} />
                      ) : (
                        <Link2Off size={14} />
                      )}
                    </button>
                    <span className="ai-dimensions__label">H</span>
                    <input
                      type="number"
                      className="ai-dimensions__input"
                      value={height}
                      onChange={(e) =>
                        handleHeightChange(Number(e.target.value) || 0)
                      }
                      min={1}
                    />
                    <span className="ai-dimensions__unit">PX</span>
                  </div>
                </div>
              </Popover.Content>
            </Popover.Portal>
          </Popover.Root>
        </div>
        <div className="ai-control-bar__row ai-control-bar__row--generate">
          <button
            type="button"
            className="ai-control-generate"
            aria-label="生成"
            title="生成"
          >
            <Sparkles size={18} />
            生成
          </button>
        </div>
      </div>
    </div>
  );
}

export function AIPanel() {
  return (
    <div className="ai-panel">
      <ImageGenPanel />
    </div>
  );
}
