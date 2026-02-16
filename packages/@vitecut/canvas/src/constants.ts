/**
 * CanvasEditor 常量定义
 */

// 默认字体参数
export const DEFAULT_FONT_SIZE = 32;
export const DEFAULT_FONT_FAMILY = "sans-serif";
export const DEFAULT_FILL = "#ffffff";

// 选中框样式
export const SELECTION_STYLES = {
  rotateEnabled: true,
  borderStroke: "#feca28",
  borderStrokeWidth: 2,
  anchorFill: "#ffffff",
  anchorStroke: "#feca28",
  anchorSize: 10,
  anchorCornerRadius: 2,
  rotateAnchorOffset: 20,
  rotationSnapTolerance: 5,
  keepRatio: false,
  shiftBehavior: "false",
} as const;

// 旋转吸附角度
export const ROTATION_SNAPS = [0, 45, 90, 135, 180, 225, 270, 315];

// 变换变化检测精度
export const TRANSFORM_EPSILON = 0.001;
