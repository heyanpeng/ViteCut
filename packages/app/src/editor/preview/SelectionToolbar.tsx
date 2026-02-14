/**
 * 选中元素时显示的 Toolbar
 *
 * 基于 Radix UI Toolbar，跟随选中元素位置显示，避免遮挡画布内容。
 * 位置由 useSelectionToolbarPosition 通过 ref 直接更新 DOM，与 Konva 同帧。
 * 文本元素显示：加粗、斜体、删除线、下划线、字号、字体、行高、字间距、对齐、颜色。
 */
import { forwardRef, useRef, useCallback } from "react";
import type { Clip } from "@swiftav/project";
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
} from "lucide-react";
import { SELECTION_TOOLBAR_GAP } from "./constants";
import type { ToolbarPosition } from "./useSelectionToolbarPosition";
import "./SelectionToolbar.css";

/** 字体预设 */
const FONT_OPTIONS = [
  { label: "无衬线", value: "sans-serif" },
  { label: "衬线", value: "serif" },
  { label: "等宽", value: "monospace" },
  { label: "Arial", value: "Arial" },
  { label: "Georgia", value: "Georgia" },
  { label: "Times New Roman", value: "Times New Roman" },
] as const;

/** 字号预设（与项目坐标系一致，usePreviewTextSync 会按画布缩放） */
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
};

type SelectionToolbarProps = {
  /** 是否有元素被选中 */
  visible: boolean;
  /** 选中的 clip（用于读取 params 并展示格式控件） */
  selectedClip?: Clip | null;
  /** 跟随元素的定位坐标（由 hook 直接更新 DOM，此处用于首帧兜底） */
  position?: ToolbarPosition;
  /** 更新 clip 参数（写历史，用于离散操作） */
  onUpdateParams?: (clipId: string, params: Record<string, unknown>) => void;
  /** 瞬时更新（不写历史，用于拖动时的实时预览） */
  onUpdateParamsTransient?: (clipId: string, params: Record<string, unknown>) => void;
  /** 将 transient 变更提交到历史（拖动结束时调用） */
  onCommitParamsChange?: (clipId: string, prevParams: Record<string, unknown>) => void;
  /** 更新 clip 变换（位置、缩放、旋转），写历史 */
  onUpdateTransform?: (
    clipId: string,
    transform: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
    },
  ) => void;
  /** 获取元素尺寸（视频需用于翻转时位置补偿，保持中心不动） */
  getElementDimensions?: () => { width: number; height: number } | null;
};

/** 将 fontStyle 字符串解析为 bold/italic 布尔（italic 含 oblique） */
function parseFontStyle(fontStyle?: string): {
  bold: boolean;
  italic: boolean;
} {
  if (!fontStyle || fontStyle === "normal") {
    return { bold: false, italic: false };
  }
  const lower = fontStyle.toLowerCase();
  return {
    bold: lower.includes("bold"),
    italic: lower.includes("italic") || lower.includes("oblique"),
  };
}

/** 根据 bold/italic 组合为 Konva fontStyle。用 oblique 替代 italic，因 generic 字体（如 sans-serif）可能无 italic 变体，oblique 由浏览器模拟倾斜 */
function toFontStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return "oblique bold";
  if (italic) return "oblique";
  if (bold) return "bold";
  return "normal";
}

export const SelectionToolbar = forwardRef<
  HTMLDivElement,
  SelectionToolbarProps
>(function SelectionToolbar(
  {
    visible,
    selectedClip,
    position,
    onUpdateParams,
    onUpdateParamsTransient,
    onCommitParamsChange,
    onUpdateTransform,
    getElementDimensions,
  },
  ref,
) {
  if (!visible) return null;

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
  const opacity = Math.min(1, Math.max(0, Number(params.opacity) || 1));
  const opacityPercent = Math.round(opacity * 100);

  const scaleX = selectedClip?.transform?.scaleX ?? 1;
  const scaleY = selectedClip?.transform?.scaleY ?? 1;
  const rotation = selectedClip?.transform?.rotation ?? 0;

  const updateTransform = (
    patch: {
      x?: number;
      y?: number;
      scaleX?: number;
      scaleY?: number;
      rotation?: number;
    },
  ) => {
    if (clipId && onUpdateTransform) {
      onUpdateTransform(clipId, patch);
    }
  };

  /** 视频/图片翻转时补偿位置，使中心不动（含旋转时按局部坐标系补偿） */
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
        updateTransform({
          scaleX: sx * -1,
          x: x + dx,
          y: y + dy,
        });
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
        updateTransform({
          scaleY: sy * -1,
          x: x + dx,
          y: y + dy,
        });
        return;
      }
    }
    updateTransform({ scaleY: sy * -1 });
  };

  /** 左右镜像 / 上下镜像 / 旋转，文本与视频等元素共用 */
  const transformButtons = (
    <>
      <Toolbar.Button
        className="selection-toolbar__btn"
        type="button"
        aria-label="左右镜像"
        title="左右镜像"
        onClick={handleFlipHorizontal}
      >
        <FlipHorizontal2 size={16} />
      </Toolbar.Button>
      <Toolbar.Button
        className="selection-toolbar__btn"
        type="button"
        aria-label="上下镜像"
        title="上下镜像"
        onClick={handleFlipVertical}
      >
        <FlipVertical2 size={16} />
      </Toolbar.Button>
      <Toolbar.Button
        className="selection-toolbar__btn"
        type="button"
        aria-label="旋转 90°"
        title="顺时针旋转 90°"
        onClick={() => updateTransform({ rotation: (rotation ?? 0) + 90 })}
      >
        <RotateCw size={16} />
      </Toolbar.Button>
    </>
  );

  const style: React.CSSProperties =
    position != null
      ? {
          left: position.x,
          top: position.elementTop - SELECTION_TOOLBAR_GAP,
          transform: "translate(-50%, -100%)",
        }
      : { visibility: "hidden" as const };

  const update = (patch: Partial<TextClipParams>) => {
    if (clipId && onUpdateParams) {
      onUpdateParams(clipId, { ...params, ...patch });
    }
  };

  const pendingTransientRef = useRef<Partial<TextClipParams> | null>(null);
  const rafIdRef = useRef<number | null>(null);

  const flushTransient = useCallback(() => {
    if (!clipId || !onUpdateParamsTransient || !pendingTransientRef.current) return;
    onUpdateParamsTransient(clipId, pendingTransientRef.current);
    pendingTransientRef.current = null;
  }, [clipId, onUpdateParamsTransient]);

  const updateTransient = useCallback(
    (patch: Partial<TextClipParams>) => {
      if (!clipId || !onUpdateParamsTransient) return;
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

  return (
    <div ref={ref} className="selection-toolbar-wrapper" style={style}>
      <Toolbar.Root className="selection-toolbar" aria-label="元素编辑">
        {isText ? (
          <>
            {/* 加粗 / 斜体 / 删除线 / 下划线 */}
            <Toolbar.ToggleGroup
              className="selection-toolbar__toggle-group"
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
                if (nextUnderline) parts.push("underline");
                if (nextStrikethrough) parts.push("line-through");
                update({
                  fontStyle: toFontStyle(nextBold, nextItalic),
                  textDecoration: parts.join(" "),
                });
              }}
            >
              <Toolbar.ToggleItem
                value="bold"
                className="selection-toolbar__btn selection-toolbar__toggle"
                aria-label="加粗"
                title="加粗"
              >
                <Bold size={16} />
              </Toolbar.ToggleItem>
              <Toolbar.ToggleItem
                value="italic"
                className="selection-toolbar__btn selection-toolbar__toggle"
                aria-label="斜体"
                title="斜体"
              >
                <Italic size={16} />
              </Toolbar.ToggleItem>
              <Toolbar.ToggleItem
                value="strikethrough"
                className="selection-toolbar__btn selection-toolbar__toggle"
                aria-label="删除线"
                title="删除线"
              >
                <Strikethrough size={16} />
              </Toolbar.ToggleItem>
              <Toolbar.ToggleItem
                value="underline"
                className="selection-toolbar__btn selection-toolbar__toggle"
                aria-label="下划线"
                title="下划线"
              >
                <Underline size={16} />
              </Toolbar.ToggleItem>
            </Toolbar.ToggleGroup>

            <Toolbar.Separator className="selection-toolbar__separator" />

            {/* 字体（名称在字号前） */}
            <Select.Root
              value={fontFamily}
              onValueChange={(v) => update({ fontFamily: v })}
            >
              <Select.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__select-trigger"
                  type="button"
                  aria-label="字体"
                  title="字体"
                >
                  <span className="selection-toolbar__font-name">
                    {FONT_OPTIONS.find((o) => o.value === fontFamily)?.label ??
                      fontFamily}
                  </span>
                  <Select.Icon>
                    <ChevronDown size={12} />
                  </Select.Icon>
                </Toolbar.Button>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar__dropdown"
                  position="popper"
                  side="top"
                  sideOffset={4}
                >
                  {FONT_OPTIONS.map((opt) => (
                    <Select.Item
                      key={opt.value}
                      value={opt.value}
                      className="selection-toolbar__dropdown-item"
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
              <Select.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__select-trigger"
                  type="button"
                  aria-label="字号"
                  title="字号"
                >
                  <span className="selection-toolbar__font-size">
                    {fontSize}
                  </span>
                  <Select.Icon>
                    <ChevronDown size={12} />
                  </Select.Icon>
                </Toolbar.Button>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar__dropdown"
                  position="popper"
                  side="top"
                  sideOffset={4}
                >
                  {FONT_SIZE_OPTIONS.map((sz) => (
                    <Select.Item
                      key={sz}
                      value={String(sz)}
                      className="selection-toolbar__dropdown-item"
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
              <Popover.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__color-trigger"
                  type="button"
                  aria-label="文字颜色"
                  title="文字颜色"
                >
                  <Palette size={16} />
                  <span
                    className="selection-toolbar__color-swatch"
                    style={{ backgroundColor: fill }}
                  />
                </Toolbar.Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="selection-toolbar__popover"
                  side="top"
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

            {/* 不透明度 */}
            <Popover.Root
              onOpenChange={(open) => {
                if (open) {
                  opacityPopoverInitialRef.current = { ...params };
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
              <Popover.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__opacity-trigger"
                  type="button"
                  aria-label="不透明度"
                  title="不透明度"
                >
                  <Contrast size={16} />
                  <span className="selection-toolbar__opacity-value">
                    {opacityPercent}%
                  </span>
                </Toolbar.Button>
              </Popover.Trigger>
              <Popover.Portal>
                <Popover.Content
                  className="selection-toolbar__popover selection-toolbar__opacity-popover"
                  side="top"
                  sideOffset={6}
                  onOpenAutoFocus={(e) => e.preventDefault()}
                >
                  <div className="selection-toolbar__opacity-controls">
                    <Slider.Root
                      className="selection-toolbar__opacity-slider"
                      value={[opacityPercent]}
                      onValueChange={([v]) => {
                        opacityHasChangesRef.current = true;
                        const val = (v ?? 100) / 100;
                        updateTransient({ opacity: val });
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
                      <Slider.Track className="selection-toolbar__opacity-slider-track">
                        <Slider.Range className="selection-toolbar__opacity-slider-range" />
                      </Slider.Track>
                      <Slider.Thumb className="selection-toolbar__opacity-slider-thumb" />
                    </Slider.Root>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={1}
                      value={opacityPercent}
                      onChange={(e) => {
                        opacityHasChangesRef.current = true;
                        const raw = Number(e.target.value);
                        if (!Number.isFinite(raw)) return;
                        const v = Math.min(100, Math.max(0, raw)) / 100;
                        updateTransient({ opacity: v });
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
                      className="selection-toolbar__opacity-input"
                      aria-label="不透明度百分比"
                    />
                  </div>
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>

            <Toolbar.Separator className="selection-toolbar__separator" />

            {/* 行高 / 字间距 / 对齐方式 一组 */}
            <Select.Root
              value={String(lineHeight)}
              onValueChange={(v) => update({ lineHeight: Number(v) })}
            >
              <Select.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__select-trigger"
                  type="button"
                  aria-label="行高"
                  title="行高"
                >
                  <AlignVerticalSpaceBetween size={16} />
                  <Select.Icon>
                    <ChevronDown size={12} />
                  </Select.Icon>
                </Toolbar.Button>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar__dropdown"
                  position="popper"
                  side="top"
                  sideOffset={4}
                >
                  {LINE_HEIGHT_OPTIONS.map((v) => (
                    <Select.Item
                      key={v}
                      value={String(v)}
                      className="selection-toolbar__dropdown-item"
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
              <Select.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__select-trigger"
                  type="button"
                  aria-label="字间距"
                  title="字间距"
                >
                  <AlignHorizontalSpaceBetween size={16} />
                  <Select.Icon>
                    <ChevronDown size={12} />
                  </Select.Icon>
                </Toolbar.Button>
              </Select.Trigger>
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar__dropdown"
                  position="popper"
                  side="top"
                  sideOffset={4}
                >
                  {LETTER_SPACING_OPTIONS.map((v) => (
                    <Select.Item
                      key={v}
                      value={String(v)}
                      className="selection-toolbar__dropdown-item"
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
              <Select.Trigger asChild>
                <Toolbar.Button
                  className="selection-toolbar__btn selection-toolbar__select-trigger"
                  type="button"
                  aria-label="对齐方式"
                  title="对齐方式"
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
              <Select.Portal>
                <Select.Content
                  className="selection-toolbar__dropdown"
                  position="popper"
                  side="top"
                  sideOffset={4}
                >
                  {ALIGN_OPTIONS.map((opt) => {
                    const IconComponent = opt.icon;
                    return (
                      <Select.Item
                        key={opt.value}
                        value={opt.value}
                        className="selection-toolbar__dropdown-item selection-toolbar__dropdown-item--with-icon"
                      >
                        <IconComponent
                          size={16}
                          className="selection-toolbar__dropdown-icon"
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

            <Toolbar.Separator className="selection-toolbar__separator" />

            {transformButtons}
          </>
        ) : (
          transformButtons
        )}
      </Toolbar.Root>
    </div>
  );
});
