import { default as React, FC } from 'react';
import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
import { CommonProp } from '../../interface/common_prop';
import { DragLineData } from './drag_lines';
export type EditActionProps = CommonProp & {
    row: TimelineRow;
    action: TimelineAction;
    dragLineData: DragLineData;
    setEditorData: (params: TimelineRow[]) => void;
    handleTime: (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => number;
    areaRef: React.RefObject<HTMLDivElement>;
    /** 设置scroll left */
    deltaScrollLeft?: (delta: number) => void;
};
export declare const EditAction: FC<EditActionProps>;
