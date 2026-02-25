import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";
import "./Tooltip.css";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
  /** 提示框显示方向，默认 "top" */
  side?: "top" | "bottom" | "left" | "right";
  /** 延迟显示（ms），默认 300 */
  delayDuration?: number;
  /** 与触发元素的间距，默认 6px */
  sideOffset?: number;
};

/**
 * 基于 Radix 的提示框，悬停显示 content。
 * 子元素为 disabled 按钮时用 span 包裹，保证仍能触发悬停。
 */
export const Tooltip = ({
  content,
  children,
  side = "top",
  delayDuration = 300,
  sideOffset = 6,
}: TooltipProps) => {
  return (
    <RadixTooltip.Root delayDuration={delayDuration}>
      <RadixTooltip.Trigger asChild>
        <span className="tooltip-trigger">{children}</span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="tooltip-content"
          sideOffset={sideOffset}
          side={side}
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
};
