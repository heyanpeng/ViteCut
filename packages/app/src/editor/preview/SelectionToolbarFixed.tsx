/**
 * 选中元素属性编辑工具栏（固定定位）
 *
 * 绝对定位悬浮在 preview-container 顶部居中，不占据布局空间，不影响画布尺寸。
 * 选中元素时根据元素类型展示对应的编辑控件。
 * - 文本：加粗、斜体、删除线、下划线、字体、字号、颜色、不透明度、行高、字间距、对齐、镜像、旋转
 * - 视频/图片：画面调整（不透明度、亮度、对比度、饱和度、色调、模糊）、镜像、旋转；视频额外支持音量
 * - 其他：镜像、旋转
 */
import { useRef, useCallback } from "react";
import type { Clip } from "@vitecut/project";
import { Toolbar, Popover, Select, Slider } from "radix-ui";
import { HexColorPicker } from "react-colorful";
import {
  Palette,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  AlignLeft,
  AlignCenter,
  AlignRight,
  AlignHorizontalSpaceBetween,
  AlignVerticalSpaceBetween,
  ChevronDown,
  Check,
  Contrast,
  FlipHorizontal2,
  FlipVertical2,
  RotateCw,
  Volume1,
  Volume2,
  VolumeX,
} from "lucide-react";
import { TipButton, TipToggleItem, TipWrap } from "./ToolbarTooltip";
import "./SelectionToolbarFixed.css";

const BTN_CLS = "selection-toolbar-fixed__btn";
const TOGGLE_CLS =
  "selection-toolbar-fixed__btn selection-toolbar-fixed__toggle";

/** 字体预设 */
const FONT_OPTIONS = [
  { label: "无衬线", value: "sans-serif" },
  { label: "衬线", value: "serif" },
  { label: "等宽", value: "monospace" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
] as const;

/** 字号预设 */
const FONT_SIZE_OPTIONS = [
  12, 14, 16, 18, 20, 24, 28, 32, 36, 48, 60, 72,
] as const;

/** 行高预设（倍数） */
const LINE_HEIGHT_OPTIONS = [0.8, 1, 1.2, 1.25, 1.5, 1.75, 2] as const;

/** 字间距预设（项目坐标像素） */
const LETTER_SPACING_OPTIONS = [0, 1, 2, 4, 6, 8] as const;

/** 对齐方式 */
const ALIGN_OPTIONS = [
  { value: "left", label: "左对齐", icon: AlignLeft },
  { value: "center", label: "居中", icon: AlignCenter },
  { value: "right", label: "右对齐", icon: AlignRight },
] as const;

type TextClipParams = {
  text?: string;
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
  lineHeight?: number;
  letterSpacing?: number;
  align?: string;
  opacity?: number;
  /** 以下为通用扩展字段，视频等元素也可能使用 */
  brightness?: number;
  contrast?: number;
  saturation?: number;
  hueRotate?: number;
  blur?: number;
};

type SelectionToolbarFixedProps = {
  /** 是否有元素被选中 */
  visible: boolean;
  /** 选中的 clip */
  selectedClip?: Clip | null;
  /** 更新 clip 参数（写历史） */
  onUpdateParams?: (clipId: string, params: Record<string, unknown>) => void;
  /** 瞬时更新（不写历史，用于拖动时的实时预览） */
  onUpdateParamsTransient?: (
    clipId: string,
    params: Record<string, unknown>,
  ) => void;
  /** 将 transient 变更提交到历史（拖动结束时调用） */
  onCommitParamsChange?: (
    clipId: string,
    prevParams: Record<string, unknown>,
  ) => void;
  /** 更新 clip 变换（位置、缩放、旋转、不透明度），写历史 */
  onUpdateTransform?: (
    clipId: string,
    transform: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
      opacity?: number;
    },
  ) => void;
  /** 瞬时更新 clip 变换（如不透明度），不写历史。用于调整面板内拖动时实时预览 */
  onUpdateTransformTransient?: (
    clipId: string,
    transform: { opacity?: number },
  ) => void;
  /** 将 transient 的 transform 变更提交到历史。调整面板关闭时调用 */
  onCommitTransformChange?: (
    clipId: string,
    prevTransform: Record<string, unknown>,
  ) => void;
  /** 获取元素尺寸（视频需用于翻转时位置补偿） */
  getElementDimensions?: () => { width: number; height: number } | null;
};

/** 将 fontStyle 字符串解析为 bold/italic 布尔 */
const parseFontStyle = (
  fontStyle?: string,
): { bold: boolean; italic: boolean } => {
  if (!fontStyle || fontStyle === "normal") {
    return { bold: false, italic: false };
  }
  const lower = fontStyle.toLowerCase();
  return {
    bold: lower.includes("bold"),
    italic: lower.includes("italic") || lower.includes("oblique"),
  };
};

/** 根据 bold/italic 组合为 Konva fontStyle */
const toFontStyle = (bold: boolean, italic: boolean): string => {
  if (bold && italic) {
    return "oblique bold";
  }
  if (italic) {
    return "oblique";
  }
  if (bold) {
    return "bold";
  }
  return "normal";
};

export const SelectionToolbarFixed = ({
  visible,
  selectedClip,
  onUpdateParams,
  onUpdateParamsTransient,
  onCommitParamsChange,
  onUpdateTransform,
  onUpdateTransformTransient,
  onCommitTransformChange,
  getElementDimensions,
}: SelectionToolbarFixedProps) => {
  if (!visible) {
    return null;
  }

  const clipKind = selectedClip?.kind;
  const clipId = selectedClip?.id ?? "";
  const params = (selectedClip?.params ?? {}) as TextClipParams;
  const isText = clipKind === "text";

  const fill = params.fill ?? "#ffffff";
  const fontSize = params.fontSize ?? 32;
  const fontFamily = params.fontFamily ?? "sans-serif";
  const { bold, italic } = parseFontStyle(params.fontStyle);
  const deco = params.textDecoration ?? "";
  const strikethrough = deco.includes("line-through");
  const underline = deco.includes("underline");
  const lineHeight = params.lineHeight ?? 1;
  const letterSpacing = params.letterSpacing ?? 1;
  const align = params.align ?? "left";
  const opacity = Math.min(
    1,
    Math.max(
      0,
      Number.isFinite(Number(params.opacity)) ? Number(params.opacity) : 1,
    ),
  );
  const opacityPercent = Math.round(opacity * 100);

  const videoOpacity =
    clipKind === "video" || clipKind === "image"
      ? Math.min(
          1,
          Math.max(
            0,
            Number.isFinite(Number(selectedClip?.transform?.opacity))
              ? Number(selectedClip!.transform!.opacity)
              : 1,
          ),
        )
      : opacity;
  const videoOpacityPercent = Math.round(videoOpacity * 100);

  const videoParams = (selectedClip?.params ?? {}) as TextClipParams;
  const mediaBrightness =
    (clipKind === "video" || clipKind === "image") &&
    Number.isFinite(Number(videoParams.brightness))
      ? Number(videoParams.brightness)
      : 100;
  const mediaContrast =
    (clipKind === "video" || clipKind === "image") &&
    Number.isFinite(Number(videoParams.contrast))
      ? Number(videoParams.contrast)
      : 100;
  const mediaSaturation =
    (clipKind === "video" || clipKind === "image") &&
    Number.isFinite(Number(videoParams.saturation))
      ? Number(videoParams.saturation)
      : 100;
  const mediaHueRotate =
    (clipKind === "video" || clipKind === "image") &&
    Number.isFinite(Number(videoParams.hueRotate))
      ? Number(videoParams.hueRotate)
      : 0;
  const mediaBlur =
    (clipKind === "video" || clipKind === "image") &&
    Number.isFinite(Number(videoParams.blur))
      ? Number(videoParams.blur)
      : 0;

  const rawVolume = Number(selectedClip?.params?.volume);
  const videoVolume =
    clipKind === "video" || clipKind === "audio"
      ? Number.isFinite(rawVolume)
        ? Math.min(1, Math.max(0, rawVolume))
        : 1
      : 1;
  const videoVolumePercent = Math.round(videoVolume * 100);

  const scaleX = selectedClip?.transform?.scaleX ?? 1;
  const scaleY = selectedClip?.transform?.scaleY ?? 1;
  const rotation = selectedClip?.transform?.rotation ?? 0;

  const updateTransform = (patch: {
    x?: number;
    y?: number;
    scaleX?: number;
    scaleY?: number;
    rotation?: number;
    opacity?: number;
  }) => {
    if (clipId && onUpdateTransform) {
      onUpdateTransform(clipId, patch);
    }
  };

  const updateTransformTransient = (patch: { opacity?: number }) => {
    if (clipId && onUpdateTransformTransient) {
      onUpdateTransformTransient(clipId, patch);
    }
  };

  const handleFlipHorizontal = () => {
    const sx = scaleX ?? 1;
    if (clipKind === "video" && getElementDimensions) {
      const dims = getElementDimensions();
      if (dims) {
        const x = selectedClip?.transform?.x ?? 0;
        const y = selectedClip?.transform?.y ?? 0;
        const rot = rotation ?? 0;
        const rad = (rot * Math.PI) / 180;
        const dx = dims.width * sx * Math.cos(rad);
        const dy = dims.width * sx * Math.sin(rad);
        updateTransform({ scaleX: sx * -1, x: x + dx, y: y + dy });
        return;
      }
    }
    updateTransform({ scaleX: sx * -1 });
  };

  const handleFlipVertical = () => {
    const sy = scaleY ?? 1;
    if (clipKind === "video" && getElementDimensions) {
      const dims = getElementDimensions();
      if (dims) {
        const x = selectedClip?.transform?.x ?? 0;
        const y = selectedClip?.transform?.y ?? 0;
        const rot = rotation ?? 0;
        const rad = (rot * Math.PI) / 180;
        const dx = -dims.height * sy * Math.sin(rad);
        const dy = dims.height * sy * Math.cos(rad);
        updateTransform({ scaleY: sy * -1, x: x + dx, y: y + dy });
        return;
      }
    }
    updateTransform({ scaleY: sy * -1 });
  };

  const update = (patch: Partial<TextClipParams>) => {
    if (clipId && onUpdateParams) {
      onUpdateParams(clipId, { ...params, ...patch });
    }
  };

  const updateVideoParams = (patch: Record<string, unknown>) => {
    if (clipId && onUpdateParams) {
      const current = (selectedClip?.params ?? {}) as Record<string, unknown>;
      onUpdateParams(clipId, { ...current, ...patch });
    }
  };

  const pendingTransientRef = useRef<Partial<TextClipParams> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const flushTransient = useCallback(() => {
    if (!clipId || !onUpdateParamsTransient || !pendingTransientRef.current) {
      return;
    }
    onUpdateParamsTransient(clipId, pendingTransientRef.current);
    pendingTransientRef.current = null;
  }, [clipId, onUpdateParamsTransient]);

  const updateTransient = useCallback(
    (patch: Partial<TextClipParams>) => {
      if (!clipId || !onUpdateParamsTransient) {
        return;
      }
      pendingTransientRef.current = {
        ...pendingTransientRef.current,
        ...patch,
      };
      if (rafIdRef.current == null) {
        rafIdRef.current = requestAnimationFrame(() => {
          flushTransient();
          rafIdRef.current = null;
        });
      }
    },
    [clipId, onUpdateParamsTransient, flushTransient],
  );

  const commitTransient = useCallback(
    (prevParams: Record<string, unknown>) => {
      if (rafIdRef.current != null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      pendingTransientRef.current = null;
      if (clipId && onCommitParamsChange) {
        onCommitParamsChange(clipId, prevParams);
      }
    },
    [clipId, onCommitParamsChange],
  );

  const colorPopoverInitialRef = useRef<Record<string, unknown> | null>(null);
  const colorHasChangesRef = useRef(false);
  const opacityPopoverInitialRef = useRef<Record<string, unknown> | null>(null);
  const opacityHasChangesRef = useRef(false);
  const videoAdjustPopoverInitialRef = useRef<Record<string, unknown> | null>(
    null,
  );
  const videoAdjustPopoverTransformInitialRef = useRef<Record<
    string,
    unknown
  > | null>(null);

  /** 镜像 / 旋转按钮（所有类型共用） */
  const transformButtons = (
    <>
      <TipButton
        label="左右镜像"
        className={BTN_CLS}
        onClick={handleFlipHorizontal}
      >
        <FlipHorizontal2 size={16} />
      </TipButton>
      <TipButton
        label="上下镜像"
        className={BTN_CLS}
        onClick={handleFlipVertical}
      >
        <FlipVertical2 size={16} />
      </TipButton>
      <TipButton
        label="顺时针旋转 90°"
        className={BTN_CLS}
        onClick={() => updateTransform({ rotation: (rotation ?? 0) + 90 })}
      >
        <RotateCw size={16} />
      </TipButton>
    </>
  );

  /** 不透明度 Popover（文本用 params.opacity，视频/图片用 transform.opacity） */
  const opacityPopover = (
    isUseTransformOpacity: boolean,
    currentPercent: number,
  ) => (
    <Popover.Root
      onOpenChange={(open) => {
        if (open) {
          opacityPopoverInitialRef.current = isUseTransformOpacity
            ? { opacity: selectedClip?.transform?.opacity ?? 1 }
            : { ...params };
          opacityHasChangesRef.current = false;
        } else {
          if (
            opacityHasChangesRef.current &&
            opacityPopoverInitialRef.current &&
            onCommitParamsChange
          ) {
            flushTransient();
            commitTransient(opacityPopoverInitialRef.current);
            opacityPopoverInitialRef.current = null;
            opacityHasChangesRef.current = false;
          }
        }
      }}
    >
      <TipWrap label="不透明度">
        <Popover.Trigger asChild>
          <Toolbar.Button
            className={`${BTN_CLS} selection-toolbar-fixed__opacity-trigger`}
            type="button"
            aria-label="不透明度"
          >
            <Contrast size={16} />
            <span className="selection-toolbar-fixed__opacity-value">
              {currentPercent}%
            </span>
          </Toolbar.Button>
        </Popover.Trigger>
      </TipWrap>
      <Popover.Portal>
        <Popover.Content
          className="selection-toolbar-fixed__popover selection-toolbar-fixed__opacity-popover"
          side="bottom"
          sideOffset={6}
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          <div className="selection-toolbar-fixed__opacity-controls">
            <Slider.Root
              className="selection-toolbar-fixed__opacity-slider"
              value={[currentPercent]}
              onValueChange={([v]) => {
                opacityHasChangesRef.current = true;
                const val = (v ?? 100) / 100;
                if (isUseTransformOpacity) {
                  updateTransform({ opacity: val });
                } else {
                  updateTransient({ opacity: val });
                }
              }}
              onValueCommit={() => {
                if (
                  opacityHasChangesRef.current &&
                  opacityPopoverInitialRef.current &&
                  onCommitParamsChange
                ) {
                  flushTransient();
                  commitTransient(opacityPopoverInitialRef.current);
                  opacityPopoverInitialRef.current = null;
                  opacityHasChangesRef.current = false;
                }
              }}
              min={0}
              max={100}
              step={1}
            >
              <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
              </Slider.Track>
              <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
            </Slider.Root>
            <input
              type="number"
              min={0}
              max={100}
              step={1}
              value={currentPercent}
              onChange={(e) => {
                opacityHasChangesRef.current = true;
                const raw = Number(e.target.value);
                if (!Number.isFinite(raw)) {
                  return;
                }
                const v = Math.min(100, Math.max(0, raw)) / 100;
                if (isUseTransformOpacity) {
                  updateTransform({ opacity: v });
                } else {
                  updateTransient({ opacity: v });
                }
              }}
              onBlur={() => {
                if (
                  opacityHasChangesRef.current &&
                  opacityPopoverInitialRef.current &&
                  onCommitParamsChange
                ) {
                  flushTransient();
                  commitTransient(opacityPopoverInitialRef.current);
                  opacityPopoverInitialRef.current = null;
                  opacityHasChangesRef.current = false;
                }
              }}
              className="selection-toolbar-fixed__opacity-input"
              aria-label="不透明度百分比"
            />
          </div>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );

  /** 视频/图片画面调整（不透明度 + 亮度 / 对比度 / 饱和度 / 色调 / 模糊） */
  const mediaAdjustmentsPopover =
    clipKind === "video" || clipKind === "image" ? (
      <Popover.Root
        onOpenChange={(open) => {
          if (open) {
            videoAdjustPopoverInitialRef.current = {
              ...(selectedClip?.params ?? {}),
            };
            videoAdjustPopoverTransformInitialRef.current = {
              ...(selectedClip?.transform ?? {}),
            };
          } else {
            videoAdjustPopoverInitialRef.current = null;
            videoAdjustPopoverTransformInitialRef.current = null;
          }
        }}
      >
        <TipWrap label="画面调整">
          <Popover.Trigger asChild>
            <Toolbar.Button
              className={`${BTN_CLS} selection-toolbar-fixed__select-trigger selection-toolbar-fixed__adjust-trigger`}
              type="button"
              aria-label="画面调整"
            >
              <Contrast size={16} />
              <span className="selection-toolbar-fixed__adjust-label">
                调整
              </span>
              <ChevronDown size={12} />
            </Toolbar.Button>
          </Popover.Trigger>
        </TipWrap>
        <Popover.Portal>
          <Popover.Content
            className="selection-toolbar-fixed__popover selection-toolbar-fixed__adjust-popover"
            side="bottom"
            sideOffset={6}
            onOpenAutoFocus={(e) => e.preventDefault()}
          >
            <div className="selection-toolbar-fixed__adjust-list">
              {/* 不透明度 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    不透明度
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {videoOpacityPercent}%
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[videoOpacityPercent]}
                  onValueChange={([v]) => {
                    const val = (v ?? 100) / 100;
                    updateTransformTransient({ opacity: val });
                  }}
                  onValueCommit={() => {
                    if (
                      videoAdjustPopoverTransformInitialRef.current &&
                      onCommitTransformChange
                    ) {
                      onCommitTransformChange(
                        clipId,
                        videoAdjustPopoverTransformInitialRef.current,
                      );
                      videoAdjustPopoverTransformInitialRef.current = {
                        ...(selectedClip?.transform ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={100}
                  step={1}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>

              {/* 亮度 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    亮度
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {mediaBrightness}%
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[mediaBrightness]}
                  onValueChange={([v]) => {
                    const val = Math.min(200, Math.max(0, v ?? 100));
                    updateTransient({ brightness: val });
                  }}
                  onValueCommit={() => {
                    flushTransient();
                    if (
                      videoAdjustPopoverInitialRef.current &&
                      onCommitParamsChange
                    ) {
                      commitTransient(videoAdjustPopoverInitialRef.current);
                      videoAdjustPopoverInitialRef.current = {
                        ...(selectedClip?.params ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>

              {/* 对比度 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    对比度
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {mediaContrast}%
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[mediaContrast]}
                  onValueChange={([v]) => {
                    const val = Math.min(200, Math.max(0, v ?? 100));
                    updateTransient({ contrast: val });
                  }}
                  onValueCommit={() => {
                    flushTransient();
                    if (
                      videoAdjustPopoverInitialRef.current &&
                      onCommitParamsChange
                    ) {
                      commitTransient(videoAdjustPopoverInitialRef.current);
                      videoAdjustPopoverInitialRef.current = {
                        ...(selectedClip?.params ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>

              {/* 饱和度 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    饱和度
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {mediaSaturation}%
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[mediaSaturation]}
                  onValueChange={([v]) => {
                    const val = Math.min(200, Math.max(0, v ?? 100));
                    updateTransient({ saturation: val });
                  }}
                  onValueCommit={() => {
                    flushTransient();
                    if (
                      videoAdjustPopoverInitialRef.current &&
                      onCommitParamsChange
                    ) {
                      commitTransient(videoAdjustPopoverInitialRef.current);
                      videoAdjustPopoverInitialRef.current = {
                        ...(selectedClip?.params ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={200}
                  step={1}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>

              {/* 色调 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    色调
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {mediaHueRotate}°
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[mediaHueRotate]}
                  onValueChange={([v]) => {
                    const val = Math.min(360, Math.max(0, v ?? 0));
                    updateTransient({ hueRotate: val });
                  }}
                  onValueCommit={() => {
                    flushTransient();
                    if (
                      videoAdjustPopoverInitialRef.current &&
                      onCommitParamsChange
                    ) {
                      commitTransient(videoAdjustPopoverInitialRef.current);
                      videoAdjustPopoverInitialRef.current = {
                        ...(selectedClip?.params ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={360}
                  step={1}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>

              {/* 模糊 */}
              <div className="selection-toolbar-fixed__adjust-row">
                <div className="selection-toolbar-fixed__adjust-row-header">
                  <span className="selection-toolbar-fixed__adjust-row-label">
                    模糊
                  </span>
                  <span className="selection-toolbar-fixed__adjust-row-value">
                    {mediaBlur}px
                  </span>
                </div>
                <Slider.Root
                  className="selection-toolbar-fixed__opacity-slider"
                  value={[mediaBlur]}
                  onValueChange={([v]) => {
                    const val = Math.min(30, Math.max(0, v ?? 0));
                    updateTransient({ blur: val });
                  }}
                  onValueCommit={() => {
                    flushTransient();
                    if (
                      videoAdjustPopoverInitialRef.current &&
                      onCommitParamsChange
                    ) {
                      commitTransient(videoAdjustPopoverInitialRef.current);
                      videoAdjustPopoverInitialRef.current = {
                        ...(selectedClip?.params ?? {}),
                      };
                    }
                  }}
                  min={0}
                  max={30}
                  step={0.5}
                >
                  <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                    <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                  </Slider.Track>
                  <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                </Slider.Root>
              </div>
            </div>
          </Popover.Content>
        </Popover.Portal>
      </Popover.Root>
    ) : null;

  return (
    <div className="selection-toolbar-fixed-wrapper">
      <Toolbar.Root
        className="selection-toolbar-fixed"
        aria-label="元素属性编辑"
      >
        {isText ? (
          <>
            {/* 加粗 / 斜体 / 删除线 / 下划线 */}
            <Toolbar.ToggleGroup
              className="selection-toolbar-fixed__toggle-group"
              type="multiple"
              value={[
                ...(bold ? ["bold"] : []),
                ...(italic ? ["italic"] : []),
                ...(strikethrough ? ["strikethrough"] : []),
                ...(underline ? ["underline"] : []),
              ]}
              onValueChange={(vals: string[]) => {
                const nextBold = vals.includes("bold");
                const nextItalic = vals.includes("italic");
                const nextStrikethrough = vals.includes("strikethrough");
                const nextUnderline = vals.includes("underline");
                const parts: string[] = [];
                if (nextUnderline) {
                  parts.push("underline");
                }
                if (nextStrikethrough) {
                  parts.push("line-through");
                }
                update({
                  fontStyle: toFontStyle(nextBold, nextItalic),
                  textDecoration: parts.join(" "),
                });
              }}
            >
              <TipToggleItem value="bold" label="加粗" className={TOGGLE_CLS}>
                <Bold size={16} />
              </TipToggleItem>
              <TipToggleItem value="italic" label="斜体" className={TOGGLE_CLS}>
                <Italic size={16} />
              </TipToggleItem>
              <TipToggleItem
                value="strikethrough"
                label="删除线"
                className={TOGGLE_CLS}
              >
                <Strikethrough size={16} />
              </TipToggleItem>
              <TipToggleItem
                value="underline"
                label="下划线"
                className={TOGGLE_CLS}
              >
                <Underline size={16} />
              </TipToggleItem>
            </Toolbar.ToggleGroup>

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {/* 字体 */}
            <Select.Root
              value={fontFamily}
              onValueChange={(v) => update({ fontFamily: v })}
            >
              <TipWrap label="字体">
                <Select.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__select-trigger`}
                    type="button"
                    aria-label="字体"
                  >
                    <span className="selection-toolbar-fixed__font-name">
                      {FONT_OPTIONS.find((o) => o.value === fontFamily)
                        ?.label ?? fontFamily}
                    </span>
                    <Select.Icon>
                      <ChevronDown size={12} />
                    </Select.Icon>
                  </Toolbar.Button>
                </Select.Trigger>
              </TipWrap>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar-fixed__dropdown"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                >
                  {FONT_OPTIONS.map((opt) => (
                    <Select.Item
                      key={opt.value}
                      value={opt.value}
                      className="selection-toolbar-fixed__dropdown-item"
                    >
                      <Select.ItemText>{opt.label}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* 字号 */}
            <Select.Root
              value={String(fontSize)}
              onValueChange={(v) => update({ fontSize: Number(v) })}
            >
              <TipWrap label="字号">
                <Select.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__select-trigger`}
                    type="button"
                    aria-label="字号"
                  >
                    <span className="selection-toolbar-fixed__font-size">
                      {fontSize}
                    </span>
                    <Select.Icon>
                      <ChevronDown size={12} />
                    </Select.Icon>
                  </Toolbar.Button>
                </Select.Trigger>
              </TipWrap>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar-fixed__dropdown"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                >
                  {FONT_SIZE_OPTIONS.map((sz) => (
                    <Select.Item
                      key={sz}
                      value={String(sz)}
                      className="selection-toolbar-fixed__dropdown-item"
                    >
                      <Select.ItemText>{sz}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* 颜色 */}
            <Popover.Root
              onOpenChange={(open) => {
                if (open) {
                  colorPopoverInitialRef.current = { ...params };
                  colorHasChangesRef.current = false;
                } else {
                  if (
                    colorHasChangesRef.current &&
                    colorPopoverInitialRef.current &&
                    onCommitParamsChange
                  ) {
                    flushTransient();
                    commitTransient(colorPopoverInitialRef.current);
                    colorPopoverInitialRef.current = null;
                    colorHasChangesRef.current = false;
                  }
                }
              }}
            >
              <TipWrap label="文字颜色">
                <Popover.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__color-trigger`}
                    type="button"
                    aria-label="文字颜色"
                  >
                    <Palette size={16} />
                    <span
                      className="selection-toolbar-fixed__color-swatch"
                      style={{ backgroundColor: fill }}
                    />
                  </Toolbar.Button>
                </Popover.Trigger>
              </TipWrap>
              <Popover.Portal>
                <Popover.Content
                  className="selection-toolbar-fixed__popover"
                  side="bottom"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <HexColorPicker
                    color={fill}
                    onChange={(c) => {
                      colorHasChangesRef.current = true;
                      updateTransient({ fill: c });
                    }}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            {/* 不透明度（文本用 params.opacity） */}
            {opacityPopover(false, opacityPercent)}

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {/* 行高 */}
            <Select.Root
              value={String(lineHeight)}
              onValueChange={(v) => update({ lineHeight: Number(v) })}
            >
              <TipWrap label="行高">
                <Select.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__select-trigger`}
                    type="button"
                    aria-label="行高"
                  >
                    <AlignVerticalSpaceBetween size={16} />
                    <Select.Icon>
                      <ChevronDown size={12} />
                    </Select.Icon>
                  </Toolbar.Button>
                </Select.Trigger>
              </TipWrap>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar-fixed__dropdown"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                >
                  {LINE_HEIGHT_OPTIONS.map((v) => (
                    <Select.Item
                      key={v}
                      value={String(v)}
                      className="selection-toolbar-fixed__dropdown-item"
                    >
                      <Select.ItemText>{v}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* 字间距 */}
            <Select.Root
              value={String(letterSpacing)}
              onValueChange={(v) => update({ letterSpacing: Number(v) })}
            >
              <TipWrap label="字间距">
                <Select.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__select-trigger`}
                    type="button"
                    aria-label="字间距"
                  >
                    <AlignHorizontalSpaceBetween size={16} />
                    <Select.Icon>
                      <ChevronDown size={12} />
                    </Select.Icon>
                  </Toolbar.Button>
                </Select.Trigger>
              </TipWrap>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar-fixed__dropdown"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                >
                  {LETTER_SPACING_OPTIONS.map((v) => (
                    <Select.Item
                      key={v}
                      value={String(v)}
                      className="selection-toolbar-fixed__dropdown-item"
                    >
                      <Select.ItemText>{v}</Select.ItemText>
                      <Select.ItemIndicator>
                        <Check size={14} />
                      </Select.ItemIndicator>
                    </Select.Item>
                  ))}
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            {/* 对齐方式 */}
            <Select.Root
              value={align}
              onValueChange={(v) => update({ align: v })}
            >
              <TipWrap label="对齐方式">
                <Select.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__select-trigger`}
                    type="button"
                    aria-label="对齐方式"
                  >
                    {(() => {
                      const opt = ALIGN_OPTIONS.find((o) => o.value === align);
                      const IconComponent = opt?.icon ?? AlignLeft;
                      return <IconComponent size={16} />;
                    })()}
                    <Select.Icon>
                      <ChevronDown size={12} />
                    </Select.Icon>
                  </Toolbar.Button>
                </Select.Trigger>
              </TipWrap>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar-fixed__dropdown"
                  position="popper"
                  side="bottom"
                  sideOffset={4}
                >
                  {ALIGN_OPTIONS.map((opt) => {
                    const IconComponent = opt.icon;
                    return (
                      <Select.Item
                        key={opt.value}
                        value={opt.value}
                        className="selection-toolbar-fixed__dropdown-item selection-toolbar-fixed__dropdown-item--with-icon"
                      >
                        <IconComponent
                          size={16}
                          className="selection-toolbar-fixed__dropdown-icon"
                        />
                        <Select.ItemText>{opt.label}</Select.ItemText>
                        <Select.ItemIndicator>
                          <Check size={14} />
                        </Select.ItemIndicator>
                      </Select.Item>
                    );
                  })}
                </Select.Content>
              </Select.Portal>
            </Select.Root>

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {transformButtons}
          </>
        ) : clipKind === "video" ? (
          <>
            {/* 视频音量 */}
            <Popover.Root>
              <TipWrap label="音量">
                <Popover.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__opacity-trigger`}
                    type="button"
                    aria-label="音量"
                  >
                    {videoVolume <= 0 ? (
                      <VolumeX size={16} />
                    ) : videoVolume < 0.5 ? (
                      <Volume1 size={16} />
                    ) : (
                      <Volume2 size={16} />
                    )}
                    <span className="selection-toolbar-fixed__opacity-value">
                      {videoVolumePercent}%
                    </span>
                  </Toolbar.Button>
                </Popover.Trigger>
              </TipWrap>
              <Popover.Portal>
                <Popover.Content
                  className="selection-toolbar-fixed__popover selection-toolbar-fixed__opacity-popover"
                  side="bottom"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="selection-toolbar-fixed__opacity-controls">
                    <Slider.Root
                      className="selection-toolbar-fixed__opacity-slider"
                      value={[videoVolumePercent]}
                      onValueChange={([v]) => {
                        const val = (v ?? 100) / 100;
                        updateVideoParams({ volume: val });
                      }}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                        <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                      </Slider.Track>
                      <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                    </Slider.Root>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={videoVolumePercent}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) {
                          return;
                        }
                        const v = Math.min(100, Math.max(0, raw)) / 100;
                        updateVideoParams({ volume: v });
                      }}
                      className="selection-toolbar-fixed__opacity-input"
                      aria-label="音量百分比"
                    />
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {/* 视频画面调整（不透明度 / 亮度 / 对比度 / 饱和度 / 色调 / 模糊） */}
            {mediaAdjustmentsPopover}

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {transformButtons}
          </>
        ) : clipKind === "image" ? (
          <>
            {/* 图片画面调整（不透明度 / 亮度 / 对比度 / 饱和度 / 色调 / 模糊） */}
            {mediaAdjustmentsPopover}

            <Toolbar.Separator className="selection-toolbar-fixed__separator" />

            {transformButtons}
          </>
        ) : clipKind === "audio" ? (
          <>
            {/* 音频音量 */}
            <Popover.Root>
              <TipWrap label="音量">
                <Popover.Trigger asChild>
                  <Toolbar.Button
                    className={`${BTN_CLS} selection-toolbar-fixed__opacity-trigger`}
                    type="button"
                    aria-label="音量"
                  >
                    {videoVolume <= 0 ? (
                      <VolumeX size={16} />
                    ) : videoVolume < 0.5 ? (
                      <Volume1 size={16} />
                    ) : (
                      <Volume2 size={16} />
                    )}
                    <span className="selection-toolbar-fixed__opacity-value">
                      {videoVolumePercent}%
                    </span>
                  </Toolbar.Button>
                </Popover.Trigger>
              </TipWrap>
              <Popover.Portal>
                <Popover.Content
                  className="selection-toolbar-fixed__popover selection-toolbar-fixed__opacity-popover"
                  side="bottom"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="selection-toolbar-fixed__opacity-controls">
                    <Slider.Root
                      className="selection-toolbar-fixed__opacity-slider"
                      value={[videoVolumePercent]}
                      onValueChange={([v]) => {
                        const val = (v ?? 100) / 100;
                        updateVideoParams({ volume: val });
                      }}
                      min={0}
                      max={100}
                      step={1}
                    >
                      <Slider.Track className="selection-toolbar-fixed__opacity-slider-track">
                        <Slider.Range className="selection-toolbar-fixed__opacity-slider-range" />
                      </Slider.Track>
                      <Slider.Thumb className="selection-toolbar-fixed__opacity-slider-thumb" />
                    </Slider.Root>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={videoVolumePercent}
                      onChange={(e) => {
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) {
                          return;
                        }
                        const v = Math.min(100, Math.max(0, raw)) / 100;
                        updateVideoParams({ volume: v });
                      }}
                      className="selection-toolbar-fixed__opacity-input"
                      aria-label="音量百分比"
                    />
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </>
        ) : (
          <>{transformButtons}</>
        )}
      </Toolbar.Root>
    </div>
  );
};
