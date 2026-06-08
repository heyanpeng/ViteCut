import {
  BaseEdge,
  getBezierPath,
  getSmoothStepPath,
  Position,
  type EdgeProps,
} from "@xyflow/react";

const HANDLE_OFFSET = 28;

function inwardOffset(position: Position): { dx: number; dy: number } {
  switch (position) {
    case Position.Left:
      return { dx: HANDLE_OFFSET, dy: 0 };
    case Position.Right:
      return { dx: -HANDLE_OFFSET, dy: 0 };
    case Position.Top:
      return { dx: 0, dy: HANDLE_OFFSET };
    case Position.Bottom:
      return { dx: 0, dy: -HANDLE_OFFSET };
  }
}

type Curve = "bezier" | "smoothstep";

function makePromptEdge(curve: Curve) {
  return function PromptEdge({
    id,
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    markerEnd,
    style,
  }: EdgeProps) {
    const sOff = inwardOffset(sourcePosition);
    const tOff = inwardOffset(targetPosition);
    const args = {
      sourceX: sourceX + sOff.dx,
      sourceY: sourceY + sOff.dy,
      targetX: targetX + tOff.dx,
      targetY: targetY + tOff.dy,
      sourcePosition,
      targetPosition,
    };
    const [path] =
      curve === "bezier" ? getBezierPath(args) : getSmoothStepPath(args);
    return <BaseEdge id={id} path={path} markerEnd={markerEnd} style={style} />;
  };
}

export const PromptBezierEdge = makePromptEdge("bezier");
export const PromptSmoothStepEdge = makePromptEdge("smoothstep");
