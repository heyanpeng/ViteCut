/**
 * React Timeline Editor 集成封装
 *
 * - 注入三方库默认样式
 * - 支持可选「轨道前置列」：通过 renderRowPrefix 在每条轨道左侧固定渲染一块区域（如音量按钮），并与时间轴纵向滚动同步
 * - 暴露 ReactTimeline 与 TimelineState 类型
 */

import {
  Timeline as TimelineOriginal,
  type TimelineState,
} from "../vendor/react-timeline-editor/packages/timeline/dist/index.es.js";
import type { TimelineEditor } from "../vendor/react-timeline-editor/packages/timeline/dist/index.es.js";
import React, {
  forwardRef,
  useCallback,
  useRef,
  type ReactNode,
  type RefObject,
} from "react";

/** 与 Timeline onScroll 回调参数一致 */
type TimelineOnScrollParams = Parameters<
  NonNullable<TimelineEditor["onScroll"]>
>[0];
import "../vendor/react-timeline-editor/packages/timeline/dist/react-timeline-editor.css";

/** 轨道前置列宽度（px），与时间轴默认行高一致 */
const DEFAULT_ROW_PREFIX_WIDTH = 48;

/** 三方库与当前 React 类型（含 React 19）的 ReactNode 不兼容，做类型断言以通过 JSX 检查 */
const TimelineBase = TimelineOriginal as React.ComponentType<
  TimelineEditor & { ref?: React.Ref<TimelineState> }
>;

/** 轨道行信息，与 editorData 中每项一致，用于 renderRowPrefix */
export type TimelineRowForPrefix = { id: string };

/** 三方库刻度行（time area）默认高度，用于前置列顶部留白以与轨道行对齐 */
const DEFAULT_ROW_PREFIX_TOP_OFFSET_PX = 32;

export type ReactTimelineEditorProps = TimelineEditor & {
  /**
   * 每条轨道左侧固定渲染内容（如音量按钮），与时间轴纵向滚动同步。
   * 不传则不显示左侧列。
   */
  renderRowPrefix?: (row: TimelineRowForPrefix) => ReactNode;
  /** 轨道前置列宽度（px），仅在 renderRowPrefix 存在时生效 */
  rowPrefixWidth?: number;
  /**
   * 前置列顶部留白高度（px），与时间轴刻度行高度一致时，第一条轨道的按钮可与轨道对齐。
   * 默认 32，与三方库 time area 高度一致。
   */
  rowPrefixTopOffset?: number;
};

export const ReactTimeline = forwardRef<
  TimelineState,
  ReactTimelineEditorProps
>(function ReactTimeline(
  {
    renderRowPrefix,
    rowPrefixWidth = DEFAULT_ROW_PREFIX_WIDTH,
    rowPrefixTopOffset = DEFAULT_ROW_PREFIX_TOP_OFFSET_PX,
    editorData,
    rowHeight = 32,
    onScroll: onScrollVertical,
    ...rest
  },
  ref,
) {
  const rowListRef = useRef<HTMLDivElement>(null);

  const handleListScroll = useCallback(
    (e: React.UIEvent<HTMLDivElement>) => {
      const target = e.target as HTMLDivElement;
      const state =
        ref != null && typeof ref === "object" && "current" in ref
          ? (ref as RefObject<TimelineState | null>)
          : null;
      if (state?.current?.setScrollTop) {
        state.current.setScrollTop(target.scrollTop);
      }
    },
    [ref],
  );

  const handleTimelineScroll = useCallback(
    (params: TimelineOnScrollParams) => {
      const el = rowListRef.current;
      if (el && el.scrollTop !== params.scrollTop) {
        el.scrollTop = params.scrollTop;
      }
      onScrollVertical?.(params);
    },
    [onScrollVertical],
  );

  if (
    renderRowPrefix == null ||
    editorData == null ||
    editorData.length === 0
  ) {
    return (
      <TimelineBase
        ref={ref}
        {...rest}
        editorData={editorData}
        rowHeight={rowHeight}
        onScroll={onScrollVertical}
      />
    );
  }

  const width = rest.style?.width ?? "100%";
  const height = rest.style?.height ?? "100%";

  return (
    <div
      style={{
        display: "flex",
        width,
        height,
        overflow: "hidden",
      }}
    >
      <div
        ref={rowListRef}
        className="vitecut-timeline-row-prefix-list"
        style={{
          width: rowPrefixWidth,
          flexShrink: 0,
          overflow: "auto",
          height: "100%",
        }}
        onScroll={handleListScroll}
      >
        {rowPrefixTopOffset > 0 && (
          <div
            className="vitecut-timeline-row-prefix-spacer"
            style={{
              height: rowPrefixTopOffset,
              flexShrink: 0,
            }}
            aria-hidden
          />
        )}
        {editorData.map((row) => (
          <div
            key={row.id}
            className="vitecut-timeline-row-prefix-cell"
            style={{
              width: "100%",
              height: rowHeight,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {renderRowPrefix(row)}
          </div>
        ))}
      </div>
      <div style={{ flex: 1, minWidth: 0, overflow: "hidden" }}>
        <TimelineBase
          ref={ref}
          {...rest}
          editorData={editorData}
          rowHeight={rowHeight}
          onScroll={handleTimelineScroll}
        />
      </div>
    </div>
  );
});

export type { TimelineState };
