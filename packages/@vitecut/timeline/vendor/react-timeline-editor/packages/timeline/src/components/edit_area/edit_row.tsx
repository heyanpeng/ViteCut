import React, { FC, useRef, useCallback } from 'react';
import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
import { CommonProp } from '../../interface/common_prop';
import { prefix } from '../../utils/deal_class_prefix';
import { parserPixelToTime } from '../../utils/deal_data';
import { DragLineData } from './drag_lines';
import { EditAction } from './edit_action';
import './edit_row.less';

export type EditRowProps = CommonProp & {
  areaRef: React.RefObject<HTMLDivElement>;
  rowData?: TimelineRow;
  style?: React.CSSProperties;
  dragLineData: DragLineData;
  setEditorData: (params: TimelineRow[]) => void;
  /** 距离左侧滚动距离 */
  scrollLeft: number;
  /** 设置scroll left */
  deltaScrollLeft: (scrollLeft: number) => void;
  /** 拖拽相关属性 */
  rowIndex?: number;
  /** 当前拖拽状态 */
  dragState?: {
    isDragging: boolean;
    draggedIndex: number;
  };
};

export const EditRow: FC<EditRowProps> = (props) => {
  const { rowData, style = {}, onClickRow, onDoubleClickRow, onContextMenuRow, areaRef, scrollLeft, startLeft, scale, scaleWidth, enableRowDrag, onRowDragStart, rowIndex = -1, dragState } = props;

  const classNames = ['edit-row'];
  if (rowData?.selected) classNames.push('edit-row-selected');

  // 如果当前行正在被拖拽，添加拖拽样式
  if (dragState?.isDragging && dragState.draggedIndex === rowIndex) {
    classNames.push('edit-row-dragging');
  }

  const dragHandleRef = useRef<HTMLDivElement>(null);

  const handleTime = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!areaRef.current) return 0;
    const rect = areaRef.current.getBoundingClientRect();
    const position = e.clientX - rect.x;
    const left = position + scrollLeft;
    const time = parserPixelToTime(left, { startLeft, scale, scaleWidth });
    return time;
  };

  // 拖拽手柄鼠标按下事件
  const handleDragHandleMouseDown = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!enableRowDrag || !rowData || rowIndex === -1) return;

      e.preventDefault();
      e.stopPropagation();

      // 触发拖拽开始回调 - 传递给EditArea组件处理
      onRowDragStart?.({ row: rowData });
    },
    [enableRowDrag, rowData, rowIndex, onRowDragStart],
  );

  return (
    <div
      className={`${prefix(...classNames)} ${(rowData?.classNames || []).join(' ')}`}
      style={style}
      onClick={(e) => {
        if (rowData && onClickRow) {
          const time = handleTime(e);
          onClickRow(e, { row: rowData, time: time });
        }
      }}
      onDoubleClick={(e) => {
        if (rowData && onDoubleClickRow) {
          const time = handleTime(e);
          onDoubleClickRow(e, { row: rowData, time: time });
        }
      }}
      onContextMenu={(e) => {
        if (rowData && onContextMenuRow) {
          const time = handleTime(e);
          onContextMenuRow(e, { row: rowData, time: time });
        }
      }}
    >
      {/* 拖拽手柄 */}
      {enableRowDrag && rowData && (
        <div ref={dragHandleRef} className={prefix('edit-row-drag-handle')} onMouseDown={handleDragHandleMouseDown} title="拖拽调整行顺序">
          ⋮⋮
        </div>
      )}

      {(rowData?.actions || []).map((action: TimelineAction) => (
        <EditAction key={action.id} {...props} handleTime={handleTime} row={rowData!} action={action} />
      ))}
    </div>
  );
};
