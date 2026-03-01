import { useState, useRef, useEffect } from "react";
import { Select, Popover } from "radix-ui";
import { useTaskStore } from "@/stores";
import { useToast } from "@/components/Toaster";
import { generateAiImage } from "@/api/aiApi";
import { createTask, type ApiTask } from "@/api/tasksApi";
import { notifyMediaAdded } from "@/utils/mediaNotifications";
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
  Wand2,
  FileCheck,
  Expand,
  Shrink,
  Smile,
  GraduationCap,
} from "lucide-react";
import "./AIPanel.css";

// 创作类型
const CREATION_TYPES = [
  { id: "image", label: "图片生成", icon: Image },
  { id: "video", label: "视频生成", icon: Video },
];

// 图片生成模型（豆包 Seedream，单张价格：元）
const IMAGE_MODELS = [
  { id: "doubao-seedream-5.0-lite", name: "Seedream 5.0 Lite", price: 0.22 },
  { id: "doubao-seedream-4.5", name: "Seedream 4.5", price: 0.25 },
  { id: "doubao-seedream-4.0", name: "Seedream 4.0", price: 0.2 },
  { id: "doubao-seedream-3.0-t2i", name: "Seedream 3.0 T2I", price: 0.259 },
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

/** 提示词 AI 优化类型 */
type PromptEnhanceType =
  | "proofread"
  | "polish"
  | "expand"
  | "abbreviate"
  | "more-fun"
  | "more-pro";

const PROMPT_ENHANCE_OPTIONS: {
  id: PromptEnhanceType;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}[] = [
  { id: "proofread", label: "校对", icon: FileCheck },
  { id: "polish", label: "润色", icon: Wand2 },
  { id: "expand", label: "扩写", icon: Expand },
  { id: "abbreviate", label: "缩写", icon: Shrink },
  { id: "more-fun", label: "更有趣", icon: Smile },
  { id: "more-pro", label: "更专业", icon: GraduationCap },
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

/** 将服务端任务转为本地 Task（resultUrl 从 results[0].url 来） */
function apiTaskToTask(api: ApiTask): {
  id: string;
  type: ApiTask["type"];
  status: ApiTask["status"];
  label: string;
  progress?: number;
  message?: string;
  resultUrl?: string;
  createdAt: number;
  updatedAt: number;
} {
  return {
    id: api.id,
    type: api.type,
    status: api.status,
    label: api.label,
    progress: api.progress,
    message: api.message,
    resultUrl: api.results?.[0]?.url,
    createdAt: api.createdAt,
    updatedAt: api.updatedAt,
  };
}

function ImageGenPanel() {
  const addTask = useTaskStore((s) => s.addTask);
  const addServerTask = useTaskStore((s) => s.addServerTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { showToast } = useToast();
  const [creationType, setCreationType] = useState("image");
  const [selectedModel, setSelectedModel] = useState(
    "doubao-seedream-5.0-lite"
  );
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
  const [polishing, setPolishing] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);

  /** 根据类型生成 mock 优化结果，后续可替换为真实 LLM 接口 */
  const getMockEnhanced = (
    text: string,
    type: PromptEnhanceType,
    isImage: boolean
  ): string => {
    const maxLen = isImage ? 200 : 500;
    const imgSuffix = "，高清画质，专业摄影，细节丰富，光影自然";
    const vidSuffix = "，流畅运镜，电影质感，动作连贯，画面稳定";
    switch (type) {
      case "polish":
        return (text + (isImage ? imgSuffix : vidSuffix)).slice(0, maxLen);
      case "proofread":
        return text
          .replace(/，\s*，/g, "，")
          .replace(/。\s*。/g, "。")
          .replace(/\s+/g, " ")
          .trim()
          .slice(0, maxLen);
      case "expand":
        return (
          text +
          (isImage
            ? "，构图考究，层次分明，氛围感强"
            : "，节奏舒缓，过渡自然，富有感染力")
        ).slice(0, maxLen);
      case "abbreviate":
        return text.slice(0, Math.max(20, Math.floor(text.length * 0.6)));
      case "more-fun":
        return (
          text +
          (isImage
            ? "，生动活泼，色彩明快，充满趣味"
            : "，轻松欢快，富有创意，引人入胜")
        ).slice(0, maxLen);
      case "more-pro":
        return (
          text +
          (isImage
            ? "，专业级画质，商业可用，细节精准"
            : "，镜头语言专业，剪辑节奏精准，成片水准")
        ).slice(0, maxLen);
      default:
        return text.slice(0, maxLen);
    }
  };

  /** 生成按钮：图片走 createTask + 生图 API，视频为模拟 */
  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("请先输入描述", "info");
      return;
    }
    const isImage = creationType === "image";
    const shortPrompt = trimmed.slice(0, 16) || "无提示词";
    const label = isImage
      ? `AI 生图 ${shortPrompt}`
      : `AI 生视频 ${shortPrompt}`;
    const taskType = isImage ? "ai-image" : "ai-video";
    if (isImage) {
      let serverTaskId: string | null = null;
      try {
        const apiTask = await createTask({
          type: "ai-image",
          label,
          status: "pending",
        });
        serverTaskId = apiTask.id;
        addServerTask(apiTaskToTask(apiTask));
        showToast("开始生成图片", "info");
        const { imageUrl, record, task: updatedTask } =
          await generateAiImage({
            prompt: trimmed,
            aspectRatio: aspectRatio,
            resolution: resolution,
            model: selectedModel,
            taskId: apiTask.id,
          });
        notifyMediaAdded(record);
        showToast("图片生成完成，已添加到媒体库");
        if (updatedTask) {
          updateTask(apiTask.id, {
            status: updatedTask.status as "success" | "failed",
            message: updatedTask.message,
            resultUrl: updatedTask.results?.[0]?.url ?? imageUrl,
          });
        } else {
          updateTask(apiTask.id, {
            status: "success",
            resultUrl: imageUrl,
          });
        }
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : "生成失败";
        showToast(msg, "error");
        if (serverTaskId) {
          updateTask(serverTaskId, { status: "failed", message: msg });
        }
      }
      return;
    }
    const taskId = addTask({
      type: taskType,
      status: "running",
      label,
    });
    showToast("开始生成视频", "info");
    setTimeout(() => {
      updateTask(taskId, {
        status: "success",
        resultUrl:
          "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4",
      });
      showToast("视频生成完成");
    }, 2000);
  };

  /** AI 优化提示词（润色、校对、扩写等） */
  const handleEnhance = async (type: PromptEnhanceType) => {
    setEnhanceOpen(false);
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("请先输入描述再优化", "info");
      return;
    }
    const label =
      PROMPT_ENHANCE_OPTIONS.find((o) => o.id === type)?.label ?? type;
    setPolishing(true);
    showToast(`AI 正在${label}…`, "info");
    try {
      await new Promise((r) => setTimeout(r, 600));
      const enhanced = getMockEnhanced(trimmed, type, creationType === "image");
      setPrompt(enhanced);
      showToast(`${label}完成`, "success");
    } finally {
      setPolishing(false);
    }
  };

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
          if (
            target.closest(".ai-ref-delete") ||
            target.closest(".ai-prompt-enhance")
          )
            return;
          if (isImageMode) {
            if (target.closest(".ai-ref-add-btn")) {
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
            f.type.startsWith("image/")
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
            <div className="ai-prompt-wrap">
              <textarea
                className="ai-prompt-input"
                placeholder="请描述你想生成的图片"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
                maxLength={200}
              />
              <div className="ai-prompt-enhance">
                <Popover.Root open={enhanceOpen} onOpenChange={setEnhanceOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="ai-prompt-enhance-btn"
                      disabled={polishing}
                      title="AI 优化：润色、校对、扩写等"
                      aria-label="AI 优化"
                    >
                      <Wand2 size={14} />
                      AI 优化
                      <ChevronDown size={12} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="ai-prompt-enhance-content"
                      side="top"
                      sideOffset={6}
                      align="end"
                    >
                      {PROMPT_ENHANCE_OPTIONS.map(
                        ({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            className="ai-prompt-enhance-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnhance(id);
                            }}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        )
                      )}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>
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
                            prev.filter((_, idx) => idx !== i)
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
            <div className="ai-prompt-wrap">
              <textarea
                className="ai-prompt-input"
                placeholder="输入文字，描述你想创作的画面内容、运动方式等。例如：小雨滴从云朵上跳下来。"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                rows={4}
              />
              <div className="ai-prompt-enhance">
                <Popover.Root open={enhanceOpen} onOpenChange={setEnhanceOpen}>
                  <Popover.Trigger asChild>
                    <button
                      type="button"
                      className="ai-prompt-enhance-btn"
                      disabled={polishing}
                      title="AI 优化：润色、校对、扩写等"
                      aria-label="AI 优化"
                    >
                      <Wand2 size={14} />
                      AI 优化
                      <ChevronDown size={12} />
                    </button>
                  </Popover.Trigger>
                  <Popover.Portal>
                    <Popover.Content
                      className="ai-prompt-enhance-content"
                      side="top"
                      sideOffset={6}
                      align="end"
                    >
                      {PROMPT_ENHANCE_OPTIONS.map(
                        ({ id, label, icon: Icon }) => (
                          <button
                            key={id}
                            type="button"
                            className="ai-prompt-enhance-item"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEnhance(id);
                            }}
                          >
                            <Icon size={14} />
                            {label}
                          </button>
                        )
                      )}
                    </Popover.Content>
                  </Popover.Portal>
                </Popover.Root>
              </div>
            </div>
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
                              {"isNew" in m &&
                                (m as { isNew?: boolean }).isNew && (
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
                              {"price" in m
                                ? `¥${(m as { price: number }).price}/张`
                                : (m as { desc?: string }).desc}
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
            onClick={handleGenerate}
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
