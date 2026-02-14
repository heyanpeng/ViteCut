/**
 * CanvasEditor 工具函数
 */

import type Konva from "konva";
import type { TransformEvent } from "./types/editor";
import {
  TRANSFORM_EPSILON,
  SELECTION_STYLES,
  ROTATION_SNAPS,
} from "./constants";

/**
 * 将 Konva 节点转换为 TransformEvent
 */
export function nodeToTransformEvent(
  id: string,
  node: Konva.Node,
): TransformEvent {
  const scaleX = node.scaleX();
  const scaleY = node.scaleY();

  return {
    id,
    x: node.x(),
    y: node.y(),
    scaleX,
    scaleY,
    rotation: node.rotation(),
    width: node.width() ? node.width() * scaleX : undefined,
    height: node.height() ? node.height() * scaleY : undefined,
  };
}

/**
 * 检查变换是否发生变化
 */
export function hasTransformChanged(
  a: TransformEvent,
  b: TransformEvent,
): boolean {
  return (
    Math.abs(a.x - b.x) > TRANSFORM_EPSILON ||
    Math.abs(a.y - b.y) > TRANSFORM_EPSILON ||
    Math.abs(a.scaleX - b.scaleX) > TRANSFORM_EPSILON ||
    Math.abs(a.scaleY - b.scaleY) > TRANSFORM_EPSILON ||
    Math.abs(a.rotation - b.rotation) > TRANSFORM_EPSILON
  );
}

/**
 * 创建标准 Transformer 配置
 */
export function createTransformerConfig(
  node: Konva.Node,
): Konva.TransformerConfig {
  return {
    nodes: [node],
    enabledAnchors: [
      "top-left",
      "top-center",
      "top-right",
      "middle-right",
      "middle-left",
      "bottom-left",
      "bottom-center",
      "bottom-right",
    ],
    rotateEnabled: SELECTION_STYLES.rotateEnabled,
    rotateAnchorOffset: SELECTION_STYLES.rotateAnchorOffset,
    rotationSnaps: ROTATION_SNAPS,
    rotationSnapTolerance: SELECTION_STYLES.rotationSnapTolerance,
    borderStroke: SELECTION_STYLES.borderStroke,
    borderStrokeWidth: SELECTION_STYLES.borderStrokeWidth,
    anchorFill: SELECTION_STYLES.anchorFill,
    anchorStroke: SELECTION_STYLES.anchorStroke,
    anchorSize: SELECTION_STYLES.anchorSize,
    anchorCornerRadius: SELECTION_STYLES.anchorCornerRadius,
    keepRatio: SELECTION_STYLES.keepRatio,
    shiftBehavior: SELECTION_STYLES.shiftBehavior,
  };
}
