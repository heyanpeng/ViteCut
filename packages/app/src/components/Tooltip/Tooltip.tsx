import { Tooltip as RadixTooltip } from "radix-ui";
import type { ReactNode } from "react";
import "./Tooltip.css";

type TooltipProps = {
  content: ReactNode;
  children: ReactNode;
};

/**
 * 基于 Radix 的提示框，悬停显示 content。
 * 子元素为 disabled 按钮时用 span 包裹，保证仍能触发悬停。
 */
export function Tooltip({ content, children }: TooltipProps) {
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>
        <span className="tooltip-trigger">{children}</span>
      </RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          className="tooltip-content"
          sideOffset={6}
          side="top"
        >
          {content}
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}
