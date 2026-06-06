import { useLayoutEffect, useRef, useState } from "react";
import { QUICK_ADD_GROUPS } from "./workflowQuickAddConfig";
import "./WorkflowQuickAddMenu.css";

const MARGIN = 8;
const ESTIMATED_WIDTH = 296;
const ESTIMATED_HEIGHT = 480;

export type WorkflowQuickAddMenuProps = {
  open: boolean;
  anchor: { x: number; y: number } | null;
  containerSize: { width: number; height: number };
  onPickSoon: (label: string) => void;
  onClose: () => void;
};

export function WorkflowQuickAddMenu({
  open,
  anchor,
  containerSize,
  onPickSoon,
  onClose,
}: WorkflowQuickAddMenuProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(
    null
  );

  useLayoutEffect(() => {
    if (!open || !anchor) {
      setPosition(null);
      return;
    }
    const rect = ref.current?.getBoundingClientRect();
    const width = rect?.width ?? ESTIMATED_WIDTH;
    const height = rect?.height ?? ESTIMATED_HEIGHT;
    const maxLeft = Math.max(MARGIN, containerSize.width - width - MARGIN);
    const maxTop = Math.max(MARGIN, containerSize.height - height - MARGIN);
    setPosition({
      left: Math.min(Math.max(anchor.x, MARGIN), maxLeft),
      top: Math.min(Math.max(anchor.y, MARGIN), maxTop),
    });
  }, [
    open,
    anchor?.x,
    anchor?.y,
    containerSize.width,
    containerSize.height,
  ]);

  if (!open || !anchor) return null;

  const handlePick = (label: string) => {
    onPickSoon(label);
    onClose();
  };

  return (
    <div
      ref={ref}
      className="vitecut-quick-add"
      role="menu"
      aria-label="快速添加"
      onMouseDown={(event) => event.stopPropagation()}
      onClick={(event) => event.stopPropagation()}
      onDoubleClick={(event) => event.stopPropagation()}
      style={{
        left: position?.left ?? anchor.x,
        top: position?.top ?? anchor.y,
        visibility: position ? "visible" : "hidden",
      }}
    >
      {QUICK_ADD_GROUPS.map((group) => (
        <div
          key={group.id}
          className={
            group.divider
              ? "vitecut-quick-add__group vitecut-quick-add__group--divider"
              : "vitecut-quick-add__group"
          }
        >
          {group.title ? (
            <div className="vitecut-quick-add__title">{group.title}</div>
          ) : null}
          {group.items.map((item) => (
            <button
              key={item.id}
              type="button"
              role="menuitem"
              className="vitecut-quick-add__item"
              onClick={() => handlePick(item.label)}
            >
              <span className="vitecut-quick-add__icon">{item.icon}</span>
              <span className="vitecut-quick-add__text">
                <span className="vitecut-quick-add__label">{item.label}</span>
                {item.desc ? (
                  <span className="vitecut-quick-add__desc">{item.desc}</span>
                ) : null}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
