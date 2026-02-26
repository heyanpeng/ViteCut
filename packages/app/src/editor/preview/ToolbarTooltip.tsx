/**
 * Toolbar 按钮的 Tooltip 包裹组件
 *
 * 统一为 Toolbar.Button / Toolbar.ToggleItem 添加底部 Tooltip。
 * 依赖 App.tsx 中的全局 Tooltip.Provider（delayDuration=300）。
 */
import { Toolbar, Tooltip } from "radix-ui";
import "@/components/Tooltip/Tooltip.css";

/** 带 Tooltip 的 Toolbar.Button */
export const TipButton = ({
  label,
  onClick,
  className,
  children,
}: {
  label: string;
  onClick?: () => void;
  className: string;
  children: React.ReactNode;
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <Toolbar.Button
        className={className}
        type="button"
        aria-label={label}
        onClick={onClick}
      >
        {children}
      </Toolbar.Button>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="tooltip-content" side="bottom" sideOffset={6}>
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

/** 带 Tooltip 的 Toolbar.ToggleItem */
export const TipToggleItem = ({
  value,
  label,
  className,
  children,
}: {
  value: string;
  label: string;
  className: string;
  children: React.ReactNode;
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>
      <Toolbar.ToggleItem
        value={value}
        className={className}
        aria-label={label}
      >
        {children}
      </Toolbar.ToggleItem>
    </Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="tooltip-content" side="bottom" sideOffset={6}>
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);

/** 包裹 Popover.Trigger / Select.Trigger 的 Tooltip（不含按钮，由调用方提供 children） */
export const TipWrap = ({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) => (
  <Tooltip.Root>
    <Tooltip.Trigger asChild>{children}</Tooltip.Trigger>
    <Tooltip.Portal>
      <Tooltip.Content className="tooltip-content" side="bottom" sideOffset={6}>
        {label}
      </Tooltip.Content>
    </Tooltip.Portal>
  </Tooltip.Root>
);
