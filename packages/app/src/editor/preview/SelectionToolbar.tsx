/**
 * 选中元素时显示的 Toolbar
 *
 * 基于 Radix UI Toolbar，跟随选中元素位置显示，避免遮挡画布内容。
 * 位置由 useSelectionToolbarPosition 通过 ref 直接更新 DOM，与 Konva 同帧。
 * 文本元素显示：加粗、斜体、删除线、下划线、字号、字体、颜色。
 */
import { forwardRef } from "react";
import type { Clip } from "@swiftav/project";
import { Toolbar, Popover, Select } from "radix-ui";
import { HexColorPicker } from "react-colorful";
import {
  Palette,
  Type,
  Bold,
  Italic,
  Strikethrough,
  Underline,
  ChevronDown,
  Check,
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

type TextClipParams = {
  text?: string;
  fontSize?: number;
  fill?: string;
  fontFamily?: string;
  fontStyle?: string;
  textDecoration?: string;
};

type SelectionToolbarProps = {
  /** 是否有元素被选中 */
  visible: boolean;
  /** 选中的 clip（用于读取 params 并展示格式控件） */
  selectedClip?: Clip | null;
  /** 跟随元素的定位坐标（由 hook 直接更新 DOM，此处用于首帧兜底） */
  position?: ToolbarPosition;
  /** 更新 clip 参数 */
  onUpdateParams?: (clipId: string, params: Record<string, unknown>) => void;
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
  { visible, selectedClip, position, onUpdateParams },
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

            {/* 字体 */}
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
                  <Type size={16} />
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

            <Toolbar.Separator className="selection-toolbar__separator" />

            {/* 颜色 */}
            <Popover.Root>
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
                    onChange={(c) => update({ fill: c })}
                  />
                </Popover.Content>
              </Popover.Portal>
            </Popover.Root>
          </>
        ) : (
          <Toolbar.Button className="selection-toolbar__btn" type="button">
            {clipKind ?? "元素"} 已选中
          </Toolbar.Button>
        )}
      </Toolbar.Root>
    </div>
  );
});
