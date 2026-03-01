import { useState, useRef, useEffect } from "react";
import { Select, Popover, Dialog } from "radix-ui";
import { useTaskStore } from "@/stores";
import { useToast } from "@/components/Toaster";
import { useLocalStorage } from "@/hooks/useLocalStorage";
import {
  enhanceAiPrompt,
  generateAiImage,
  generateAiVideo,
  type PromptEnhanceType,
} from "@/api/aiApi";
import { createTask, type ApiTask } from "@/api/tasksApi";
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
  Clock3,
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
  Loader2,
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
    id: "seedance-1.5-pro",
    name: "Seedance 1.5 Pro",
    desc: "图生视频，支持文本+参考图生成",
    isNew: true,
  },
  {
    id: "seedance-1.0-pro",
    name: "Seedance 1.0 Pro",
    desc: "图生视频，兼容经典效果风格",
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
const MAX_REFERENCE_IMAGES = 14;
const SUPPORTED_VIDEO_RATIOS = [
  "1:1",
  "16:9",
  "9:16",
  "4:3",
  "3:4",
  "21:9",
] as const;
type SupportedVideoRatio = (typeof SUPPORTED_VIDEO_RATIOS)[number];

const AI_GEN_SETTINGS_KEY = "vitecut_ai_gen_settings";

interface AiGenSettings {
  selectedModel: string;
  selectedVideoModel: string;
  videoDuration: number;
  aspectRatio: string;
  resolution: string;
  width: number;
  height: number;
  dimensionsLinked: boolean;
}

const DEFAULT_AI_GEN_SETTINGS: AiGenSettings = {
  selectedModel: "doubao-seedream-5.0-lite",
  selectedVideoModel: "seedance-1.5-pro",
  videoDuration: 5,
  aspectRatio: "smart",
  resolution: "2k",
  width: 3024,
  height: 1296,
  dimensionsLinked: true,
};

/** 校验并补全从 localStorage 读出的配置，非法或缺失字段用默认值 */
function parseAiGenSettings(raw: unknown): AiGenSettings {
  const parsed = raw as Partial<AiGenSettings> | null;
  if (!parsed || typeof parsed !== "object") return DEFAULT_AI_GEN_SETTINGS;
  const imageIds = new Set(IMAGE_MODELS.map((m) => m.id));
  const videoIds = new Set(VIDEO_MODELS.map((m) => m.id));
  const ratioIds = new Set(ASPECT_RATIOS.map((r) => r.id));
  const resIds = new Set(RESOLUTIONS.map((r) => r.id));
  return {
    selectedModel:
      typeof parsed.selectedModel === "string" &&
      imageIds.has(parsed.selectedModel)
        ? parsed.selectedModel
        : DEFAULT_AI_GEN_SETTINGS.selectedModel,
    selectedVideoModel:
      typeof parsed.selectedVideoModel === "string" &&
      videoIds.has(parsed.selectedVideoModel)
        ? parsed.selectedVideoModel
        : DEFAULT_AI_GEN_SETTINGS.selectedVideoModel,
    videoDuration:
      typeof parsed.videoDuration === "number" &&
      Number.isFinite(parsed.videoDuration)
        ? Math.max(1, Math.min(30, Math.round(parsed.videoDuration)))
        : DEFAULT_AI_GEN_SETTINGS.videoDuration,
    aspectRatio:
      typeof parsed.aspectRatio === "string" && ratioIds.has(parsed.aspectRatio)
        ? parsed.aspectRatio
        : DEFAULT_AI_GEN_SETTINGS.aspectRatio,
    resolution:
      typeof parsed.resolution === "string" && resIds.has(parsed.resolution)
        ? parsed.resolution
        : DEFAULT_AI_GEN_SETTINGS.resolution,
    width:
      typeof parsed.width === "number" &&
      parsed.width >= 1 &&
      parsed.width <= 8192
        ? Math.round(parsed.width)
        : DEFAULT_AI_GEN_SETTINGS.width,
    height:
      typeof parsed.height === "number" &&
      parsed.height >= 1 &&
      parsed.height <= 8192
        ? Math.round(parsed.height)
        : DEFAULT_AI_GEN_SETTINGS.height,
    dimensionsLinked:
      typeof parsed.dimensionsLinked === "boolean"
        ? parsed.dimensionsLinked
        : DEFAULT_AI_GEN_SETTINGS.dimensionsLinked,
  };
}

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
  const addServerTask = useTaskStore((s) => s.addServerTask);
  const updateTask = useTaskStore((s) => s.updateTask);
  const { showToast } = useToast();
  const [creationType, setCreationType] = useState("image");
  const [settings, setSettings] = useLocalStorage<AiGenSettings>(
    AI_GEN_SETTINGS_KEY,
    DEFAULT_AI_GEN_SETTINGS,
    { parse: parseAiGenSettings }
  );
  const {
    selectedModel,
    selectedVideoModel,
    videoDuration,
    aspectRatio,
    resolution,
    width,
    height,
    dimensionsLinked,
  } = settings;
  const [startFrame, setStartFrame] = useState<File | null>(null);
  const [endFrame, setEndFrame] = useState<File | null>(null);
  const startFrameRef = useRef<HTMLInputElement>(null);
  const endFrameRef = useRef<HTMLInputElement>(null);
  const [referenceFiles, setReferenceFiles] = useState<File[]>([]);
  const [previewFile, setPreviewFile] = useState<File | null>(null);
  const [prompt, setPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [polishing, setPolishing] = useState(false);
  const [enhanceOpen, setEnhanceOpen] = useState(false);
  const refInputRef = useRef<HTMLInputElement>(null);
  const modelSupportsReferenceImages =
    selectedModel !== "doubao-seedream-3.0-t2i";

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === "string") {
          resolve(reader.result);
          return;
        }
        reject(new Error("文件读取失败"));
      };
      reader.onerror = () => reject(new Error("文件读取失败"));
      reader.readAsDataURL(file);
    });

  /** 生成按钮：任务异步执行，发起后即恢复按钮并清空输入，进度由任务列表/SSE 展示 */
  const handleGenerate = async () => {
    const trimmed = prompt.trim();
    if (!trimmed) {
      showToast("请先输入描述", "info");
      return;
    }
    if (isGenerating) return;
    setIsGenerating(true);
    const isImage = creationType === "image";
    const rawLabel = isImage ? `AI 生图 ${trimmed}` : `AI 生视频 ${trimmed}`;
    const label = rawLabel.length > 512 ? rawLabel.slice(0, 512) : rawLabel;
    try {
      if (isImage) {
        if (!modelSupportsReferenceImages && referenceFiles.length > 0) {
          showToast("当前模型仅支持文生图，请移除参考图或切换模型", "info");
          return;
        }
        const referenceImages =
          modelSupportsReferenceImages && referenceFiles.length > 0
            ? await Promise.all(
                referenceFiles.map((file) => readFileAsDataUrl(file))
              )
            : undefined;
        const apiTask = await createTask({
          type: "ai-image",
          label,
          status: "pending",
        });
        addServerTask(apiTaskToTask(apiTask));
        showToast("开始生成图片", "info");
        generateAiImage({
          prompt: trimmed,
          aspectRatio: aspectRatio,
          resolution: resolution,
          model: selectedModel,
          referenceImages,
          taskId: apiTask.id,
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : "生成失败";
          showToast(msg, "error");
          updateTask(apiTask.id, { status: "failed", message: msg });
        });
      } else {
        const imageUrl = startFrame
          ? await readFileAsDataUrl(startFrame)
          : undefined;
        const videoRatio: SupportedVideoRatio = SUPPORTED_VIDEO_RATIOS.includes(
          aspectRatio as SupportedVideoRatio
        )
          ? (aspectRatio as SupportedVideoRatio)
          : "16:9";
        const videoResolution = resolution === "4k" ? "1080p" : "720p";
        const apiTask = await createTask({
          type: "ai-video",
          label,
          status: "pending",
        });
        addServerTask(apiTaskToTask(apiTask));
        showToast("开始生成视频", "info");
        generateAiVideo({
          prompt: trimmed,
          model: selectedVideoModel,
          imageUrl,
          ratio: videoRatio,
          resolution: videoResolution,
          duration: videoDuration,
          cameraFixed: false,
          watermark: false,
          taskId: apiTask.id,
        }).catch((err) => {
          const msg = err instanceof Error ? err.message : "生成失败";
          showToast(msg, "error");
          updateTask(apiTask.id, { status: "failed", message: msg });
        });
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "生成失败";
      showToast(msg, "error");
    } finally {
      setPrompt("");
      setReferenceFiles([]);
      setStartFrame(null);
      setEndFrame(null);
      setPreviewFile(null);
      if (refInputRef.current) {
        refInputRef.current.value = "";
      }
      if (startFrameRef.current) {
        startFrameRef.current.value = "";
      }
      if (endFrameRef.current) {
        endFrameRef.current.value = "";
      }
      setIsGenerating(false);
    }
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
    try {
      const { text } = await enhanceAiPrompt({
        prompt: trimmed,
        type,
        creationType: creationType === "video" ? "video" : "image",
      });
      setPrompt(text);
    } catch (err) {
      const msg = err instanceof Error ? err.message : `${label}失败`;
      showToast(msg, "error");
    } finally {
      setPolishing(false);
    }
  };

  const handleRefFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!modelSupportsReferenceImages) {
      showToast("当前模型仅支持文生图，不支持上传参考图", "info");
      e.target.value = "";
      return;
    }
    const files = e.target.files;
    if (files?.length) {
      setReferenceFiles((prev) => {
        const next = [...prev, ...Array.from(files)];
        return next.slice(0, MAX_REFERENCE_IMAGES);
      });
    }
    e.target.value = "";
  };

  useEffect(() => {
    if (!modelSupportsReferenceImages && referenceFiles.length > 0) {
      setReferenceFiles([]);
      showToast("Seedream 3.0 T2I 仅支持文生图，已自动清空参考图", "info");
    }
  }, [modelSupportsReferenceImages, referenceFiles.length, showToast]);

  const handleWidthChange = (v: number) => {
    setSettings((prev) => ({ ...prev, width: v }));
    if (dimensionsLinked && aspectRatio !== "smart") {
      const parts = aspectRatio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        setSettings((prev) => ({ ...prev, height: Math.round((v * b) / a) }));
      }
    }
  };

  const handleHeightChange = (v: number) => {
    setSettings((prev) => ({ ...prev, height: v }));
    if (dimensionsLinked && aspectRatio !== "smart") {
      const parts = aspectRatio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        setSettings((prev) => ({ ...prev, width: Math.round((v * a) / b) }));
      }
    }
  };

  const handleAspectRatioChange = (ratio: string) => {
    if (ratio !== "smart" && dimensionsLinked) {
      const parts = ratio.split(":");
      if (parts.length === 2) {
        const [a, b] = parts.map(Number);
        const base = resolution === "4k" ? 2048 : 1024;
        const w = a >= b ? Math.round((base * a) / b) : base;
        const h = a >= b ? base : Math.round((base * b) / a);
        setSettings((prev) => ({
          ...prev,
          aspectRatio: ratio,
          width: w,
          height: h,
        }));
        return;
      }
    }
    setSettings((prev) => ({ ...prev, aspectRatio: ratio }));
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
              if (!modelSupportsReferenceImages) {
                showToast("当前模型仅支持文生图，不支持上传参考图", "info");
                return;
              }
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
            if (!modelSupportsReferenceImages) {
              showToast("当前模型仅支持文生图，不支持上传参考图", "info");
              return;
            }
            setReferenceFiles((prev) => {
              const next = [...prev, ...files];
              return next.slice(0, MAX_REFERENCE_IMAGES);
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
              <div className="ai-prompt-input-wrap">
                <textarea
                  className="ai-prompt-input"
                  placeholder="请描述你想生成的图片"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  maxLength={200}
                  readOnly={polishing}
                />
                {polishing && (
                  <div className="ai-prompt-input-loading" aria-live="polite">
                    <Loader2
                      size={14}
                      className="ai-control-generate__spinner"
                    />
                    <span>AI 正在优化提示词…</span>
                  </div>
                )}
              </div>
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
                      <button
                        type="button"
                        className="ai-ref-preview-open"
                        onClick={(e) => {
                          e.stopPropagation();
                          setPreviewFile(f);
                        }}
                        aria-label={`预览参考图 ${i + 1}`}
                      >
                        <FilePreviewImage
                          file={f}
                          className="ai-ref-preview-img ai-ref-preview-img--ratio"
                        />
                      </button>
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
                  {modelSupportsReferenceImages &&
                    referenceFiles.length < MAX_REFERENCE_IMAGES && (
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
              <div className="ai-ref-images-tip">
                {modelSupportsReferenceImages
                  ? `支持单图/多图生图，最多 ${MAX_REFERENCE_IMAGES} 张参考图（当前 ${referenceFiles.length}）`
                  : "当前模型仅支持文生图"}
              </div>
            </div>
          </>
        ) : creationType === "video" ? (
          <>
            <div className="ai-prompt-wrap">
              <div className="ai-prompt-input-wrap">
                <textarea
                  className="ai-prompt-input"
                  placeholder="输入文字，描述你想创作的画面内容、运动方式等。例如：小雨滴从云朵上跳下来。"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  rows={4}
                  readOnly={polishing}
                />
                {polishing && (
                  <div className="ai-prompt-input-loading" aria-live="polite">
                    <Loader2
                      size={14}
                      className="ai-control-generate__spinner"
                    />
                    <span>AI 正在优化提示词…</span>
                  </div>
                )}
              </div>
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
                    <button
                      type="button"
                      className="ai-ref-preview-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(startFrame);
                      }}
                      aria-label="预览首帧"
                    >
                      <FilePreviewImage
                        file={startFrame}
                        className="ai-ref-preview-img ai-ref-preview-img--frame"
                      />
                    </button>
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
                    <button
                      type="button"
                      className="ai-ref-preview-open"
                      onClick={(e) => {
                        e.stopPropagation();
                        setPreviewFile(endFrame);
                      }}
                      aria-label="预览尾帧"
                    >
                      <FilePreviewImage
                        file={endFrame}
                        className="ai-ref-preview-img ai-ref-preview-img--frame"
                      />
                    </button>
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
                onValueChange={(id) =>
                  setSettings((prev) =>
                    creationType === "video"
                      ? { ...prev, selectedVideoModel: id }
                      : { ...prev, selectedModel: id }
                  )
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
          <div className="ai-control-bar__size-wrap">
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
                          onClick={() =>
                            setSettings((prev) => ({
                              ...prev,
                              resolution: r.id,
                            }))
                          }
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
                        onClick={() =>
                          setSettings((prev) => ({
                            ...prev,
                            dimensionsLinked: !prev.dimensionsLinked,
                          }))
                        }
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
            {creationType === "video" && (
              <div className="ai-control-btn ai-video-duration-trigger">
                <Clock3 size={14} className="ai-control-btn__icon" />
                <span>时长</span>
                <input
                  type="number"
                  className="ai-video-duration-input"
                  value={videoDuration}
                  onChange={(e) => {
                    const next = Number(e.target.value);
                    setSettings((prev) => ({
                      ...prev,
                      videoDuration:
                        Number.isFinite(next) && next > 0
                          ? Math.min(30, Math.max(1, Math.round(next)))
                          : prev.videoDuration,
                    }));
                  }}
                  min={1}
                  max={30}
                  step={1}
                  aria-label="视频时长（秒）"
                />
                <span className="ai-video-duration-unit">秒</span>
              </div>
            )}
          </div>
        </div>
        <div className="ai-control-bar__row ai-control-bar__row--generate">
          <button
            type="button"
            className="ai-control-generate"
            aria-label={isGenerating ? "生成中" : "生成"}
            title={isGenerating ? "生成中" : "生成"}
            disabled={isGenerating}
            onClick={handleGenerate}
          >
            {isGenerating ? (
              <>
                <Loader2 size={18} className="ai-control-generate__spinner" />
                生成中…
              </>
            ) : (
              <>
                <Sparkles size={18} />
                生成
              </>
            )}
          </button>
        </div>
      </div>
      <Dialog.Root
        open={Boolean(previewFile)}
        onOpenChange={(open) => {
          if (!open) setPreviewFile(null);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="ai-image-preview-mask" />
          {previewFile ? (
            <Dialog.Content
              className="ai-image-preview-dialog"
              aria-label="图片预览"
            >
              <Dialog.Close asChild>
                <button
                  type="button"
                  className="ai-image-preview-close"
                  aria-label="关闭预览"
                >
                  <X size={16} />
                </button>
              </Dialog.Close>
              <FilePreviewImage
                file={previewFile}
                className="ai-image-preview-img"
              />
            </Dialog.Content>
          ) : null}
        </Dialog.Portal>
      </Dialog.Root>
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
