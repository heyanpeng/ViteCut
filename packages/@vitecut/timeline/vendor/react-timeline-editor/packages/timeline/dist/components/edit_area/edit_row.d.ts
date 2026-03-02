import { default as React, FC } from 'react';
import { TimelineRow } from '@xzdarcy/timeline-engine';
import { CommonProp } from '../../interface/common_prop';
import { DragLineData } from './drag_lines';
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
export declare const EditRow: FC<EditRowProps>;
