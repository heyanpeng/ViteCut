import {
  getBezierPath,
  Position,
  type ConnectionLineComponentProps,
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

export function PromptConnectionLine({
  fromX,
  fromY,
  fromPosition,
  toX,
  toY,
  toPosition,
  connectionLineStyle,
}: ConnectionLineComponentProps) {
  const off = inwardOffset(fromPosition);
  const [path] = getBezierPath({
    sourceX: fromX + off.dx,
    sourceY: fromY + off.dy,
    targetX: toX,
    targetY: toY,
    sourcePosition: fromPosition,
    targetPosition: toPosition,
  });
  return (
    <path
      d={path}
      fill="none"
      stroke={String(connectionLineStyle?.stroke ?? "rgba(148,163,184,0.9)")}
      strokeWidth={Number(connectionLineStyle?.strokeWidth) || 2}
    />
  );
}
