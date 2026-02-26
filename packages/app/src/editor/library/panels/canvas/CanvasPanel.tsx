import * as React from "react";
import { Select } from "radix-ui";
import classnames from "classnames";
import {
  Monitor,
  ChevronDown,
  Check,
  Video,
  Smartphone,
  Tablet,
  Square,
  RectangleHorizontal,
  RectangleVertical,
  Maximize2,
} from "lucide-react";
import "./CanvasPanel.css";
import { useProjectStore } from "@/stores";

const BASE_DIMENSION = 1080;

/** 从预设 value（如 "16:9"、"douyin-9:16"）解析宽高，以 1080 为基准 */
function parseSizeToDimensions(value: string): {
  width: number;
  height: number;
} {
  const match = value.match(/(\d+):(\d+)/);
  if (!match) return { width: 1920, height: 1080 };

  const a = Number(match[1]);
  const b = Number(match[2]);
  if (a >= b) {
    return {
      width: Math.round((BASE_DIMENSION * a) / b),
      height: BASE_DIMENSION,
    };
  }
  return {
    width: BASE_DIMENSION,
    height: Math.round((BASE_DIMENSION * b) / a),
  };
}

/** 根据当前宽高找到最接近的预设 value */
function findClosestPreset(
  width: number,
  height: number,
  presets: CanvasSize[]
): string {
  const ratio = width / height;
  let closest = presets[0];
  let minDiff = Infinity;

  for (const preset of presets) {
    const dims = parseSizeToDimensions(preset.value);
    const presetRatio = dims.width / dims.height;
    const diff = Math.abs(ratio - presetRatio);
    if (diff < minDiff) {
      minDiff = diff;
      closest = preset;
    }
  }
  return closest.value;
}

type CanvasSize = {
  label: string;
  value: string;
  group?: "social" | "general";
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

const canvasSizes: CanvasSize[] = [
  // 社交媒体预设
  { label: "抖音 — 9:16", value: "douyin-9:16", group: "social", icon: Video },
  {
    label: "抖音横屏 — 16:9",
    value: "douyin-landscape-16:9",
    group: "social",
    icon: Monitor,
  },
  {
    label: "快手 — 9:16",
    value: "kuaishou-9:16",
    group: "social",
    icon: Video,
  },
  {
    label: "小红书 — 3:4",
    value: "xiaohongshu-3:4",
    group: "social",
    icon: Tablet,
  },
  {
    label: "小红书方形 — 1:1",
    value: "xiaohongshu-square-1:1",
    group: "social",
    icon: Square,
  },
  {
    label: "视频号 — 16:9",
    value: "wechat-video-16:9",
    group: "social",
    icon: Monitor,
  },
  {
    label: "视频号竖屏 — 9:16",
    value: "wechat-video-9:16",
    group: "social",
    icon: Smartphone,
  },
  {
    label: "B站 — 16:9",
    value: "bilibili-16:9",
    group: "social",
    icon: Monitor,
  },
  {
    label: "B站竖屏 — 9:16",
    value: "bilibili-9:16",
    group: "social",
    icon: Smartphone,
  },
  // 通用预设
  {
    label: "宽屏 — 16:9",
    value: "16:9",
    group: "general",
    icon: RectangleHorizontal,
  },
  {
    label: "竖屏 — 9:16",
    value: "9:16",
    group: "general",
    icon: RectangleVertical,
  },
  { label: "方形 — 1:1", value: "1:1", group: "general", icon: Square },
  {
    label: "横屏 — 4:3",
    value: "4:3",
    group: "general",
    icon: RectangleHorizontal,
  },
  {
    label: "竖屏 — 4:5",
    value: "4:5",
    group: "general",
    icon: RectangleVertical,
  },
  {
    label: "横屏海报 — 5:4",
    value: "5:4",
    group: "general",
    icon: RectangleHorizontal,
  },
  {
    label: "竖屏 — 2:3",
    value: "2:3",
    group: "general",
    icon: RectangleVertical,
  },
  { label: "超宽屏 — 21:9", value: "21:9", group: "general", icon: Maximize2 },
];

type SelectItemProps = React.ComponentProps<typeof Select.Item> & {
  icon?: React.ComponentType<{ size?: number; className?: string }>;
};

const CanvasSelectItem = React.forwardRef<HTMLDivElement, SelectItemProps>(
  function CanvasSelectItem(
    { children, className, icon: Icon, ...props },
    ref
  ) {
    const IconComponent = Icon ?? Monitor;
    return (
      <Select.Item
        ref={ref}
        className={classnames("canvas-panel__dropdown-item", className)}
        {...props}
      >
        <IconComponent size={16} className="canvas-panel__item-icon" />
        <Select.ItemText>{children}</Select.ItemText>
        <Select.ItemIndicator className="canvas-panel__check-icon">
          <Check size={16} />
        </Select.ItemIndicator>
      </Select.Item>
    );
  }
);

type BackgroundColor =
  | { type: "gradient"; colors: string[] }
  | { type: "solid"; color: string };

const backgroundColors: BackgroundColor[] = [
  // 第一行
  {
    type: "gradient",
    colors: [
      "#ff0000",
      "#ff7f00",
      "#ffff00",
      "#00ff00",
      "#0000ff",
      "#4b0082",
      "#9400d3",
    ],
  }, // 彩虹渐变
  { type: "solid", color: "#000000" }, // 黑色
  { type: "solid", color: "#ffffff" }, // 白色
  { type: "solid", color: "#ff0000" }, // 红色
  { type: "solid", color: "#ff7f00" }, // 橙色
  { type: "solid", color: "#ffff00" }, // 黄色
  { type: "solid", color: "#00ff00" }, // 绿色
  { type: "solid", color: "#0000ff" }, // 蓝色
  { type: "solid", color: "#800080" }, // 紫色
  { type: "solid", color: "#ffc0cb" }, // 粉色
  // 第二行
  { type: "solid", color: "#808080" }, // 灰色
  { type: "solid", color: "#f5f5dc" }, // 米色
  { type: "solid", color: "#90ee90" }, // 浅绿色
  { type: "solid", color: "#add8e6" }, // 浅蓝色
  { type: "solid", color: "#ffb6c1" }, // 浅粉色
  { type: "solid", color: "#e0bbff" }, // 淡紫色
  { type: "solid", color: "#ffe4b5" }, // 浅橙色
  { type: "solid", color: "#20b2aa" }, // 浅海绿
  { type: "solid", color: "#fffacd" }, // 柠檬黄
  { type: "solid", color: "#b22222" }, // 火砖红
];

export function CanvasPanel() {
  const project = useProjectStore((s) => s.project);
  const preferredCanvasSize = useProjectStore((s) => s.preferredCanvasSize);
  const preferredCanvasPreset = useProjectStore((s) => s.preferredCanvasPreset);
  const setCanvasSize = useProjectStore((s) => s.setCanvasSize);
  const setCanvasBackgroundColor = useProjectStore(
    (s) => s.setCanvasBackgroundColor
  );
  const colorInputRef = React.useRef<HTMLInputElement>(null);
  const colorBeforePickRef = React.useRef<string>("#000000");

  React.useEffect(() => {
    const input = colorInputRef.current;
    if (!input) return;
    const handleInput = () => {
      setCanvasBackgroundColor(input.value, true);
    };
    const handleChange = () => {
      const nextColor = input.value;
      setCanvasBackgroundColor(colorBeforePickRef.current, true);
      setCanvasBackgroundColor(nextColor);
    };
    input.addEventListener("input", handleInput);
    input.addEventListener("change", handleChange);
    return () => {
      input.removeEventListener("input", handleInput);
      input.removeEventListener("change", handleChange);
    };
  }, [setCanvasBackgroundColor]);

  const selectedSize =
    preferredCanvasPreset ??
    (project != null
      ? findClosestPreset(project.width, project.height, canvasSizes)
      : findClosestPreset(
          preferredCanvasSize.width,
          preferredCanvasSize.height,
          canvasSizes
        ));

  const socialSizes = canvasSizes.filter((s) => s.group === "social");
  const generalSizes = canvasSizes.filter((s) => s.group === "general");

  const handleSelectSize = (value: string) => {
    const { width, height } = parseSizeToDimensions(value);
    setCanvasSize(width, height, value);
  };

  return (
    <div className="canvas-panel">
      <div className="canvas-panel__content">
        {/* 调整大小部分 */}
        <div className="canvas-panel__section">
          <h3 className="canvas-panel__section-title">调整大小</h3>
          <Select.Root value={selectedSize} onValueChange={handleSelectSize}>
            <Select.Trigger
              className="canvas-panel__size-selector"
              aria-label="画布尺寸"
            >
              <Monitor size={16} className="canvas-panel__monitor-icon" />
              <div className="canvas-panel__size-dropdown">
                <Select.Value
                  placeholder="选择画布尺寸…"
                  className="canvas-panel__size-label canvas-panel__size-value"
                />
                <Select.Icon className="canvas-panel__chevron-icon">
                  <ChevronDown size={16} aria-hidden />
                </Select.Icon>
              </div>
            </Select.Trigger>
            <Select.Portal>
              <Select.Content
                className="canvas-panel__dropdown-menu"
                position="popper"
                sideOffset={4}
              >
                <Select.ScrollUpButton className="canvas-panel__select-scroll-btn">
                  <ChevronDown
                    size={16}
                    style={{ transform: "rotate(180deg)" }}
                  />
                </Select.ScrollUpButton>
                <Select.Viewport className="canvas-panel__select-viewport">
                  <Select.Group>
                    <Select.Label className="canvas-panel__select-label">
                      社交媒体
                    </Select.Label>
                    {socialSizes.map((size) => (
                      <CanvasSelectItem
                        key={size.value}
                        value={size.value}
                        icon={size.icon}
                      >
                        {size.label}
                      </CanvasSelectItem>
                    ))}
                  </Select.Group>
                  <Select.Separator className="canvas-panel__dropdown-divider" />
                  <Select.Group>
                    <Select.Label className="canvas-panel__select-label">
                      通用
                    </Select.Label>
                    {generalSizes.map((size) => (
                      <CanvasSelectItem
                        key={size.value}
                        value={size.value}
                        icon={size.icon}
                      >
                        {size.label}
                      </CanvasSelectItem>
                    ))}
                  </Select.Group>
                </Select.Viewport>
                <Select.ScrollDownButton className="canvas-panel__select-scroll-btn">
                  <ChevronDown size={16} />
                </Select.ScrollDownButton>
              </Select.Content>
            </Select.Portal>
          </Select.Root>
        </div>

        {/* 背景部分 */}
        <div className="canvas-panel__section">
          <h3 className="canvas-panel__section-title">背景</h3>
          <div className="canvas-panel__color-grid">
            {backgroundColors.map((bg, index) => {
              if (bg.type === "gradient") {
                return (
                  <div
                    key={index}
                    className="canvas-panel__color-item canvas-panel__color-picker-trigger"
                    style={{
                      background: `linear-gradient(135deg, ${bg.colors.join(", ")})`,
                    }}
                    title="自定义颜色"
                    onClick={() => {
                      const currentColor =
                        useProjectStore.getState().canvasBackgroundColor;
                      colorBeforePickRef.current = currentColor;
                      if (colorInputRef.current) {
                        colorInputRef.current.value = currentColor;
                      }
                      colorInputRef.current?.click();
                    }}
                  />
                );
              }
              return (
                <div
                  key={index}
                  className="canvas-panel__color-item"
                  style={{ background: bg.color }}
                  title={bg.color}
                  onClick={() => setCanvasBackgroundColor(bg.color)}
                />
              );
            })}
            <input
              ref={colorInputRef}
              type="color"
              className="canvas-panel__color-input-hidden"
              defaultValue="#000000"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
