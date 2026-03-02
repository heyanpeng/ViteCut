import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
import { DragLineData } from '../drag_lines';
export declare function useDragLine(): {
    initDragLine: (data: {
        movePositions?: number[];
        assistPositions?: number[];
    }) => void;
    updateDragLine: (data: {
        movePositions?: number[];
        assistPositions?: number[];
    }) => void;
    disposeDragLine: () => void;
    dragLineData: DragLineData;
    defaultGetAssistPosition: (data: {
        editorData: TimelineRow[];
        assistActionIds?: string[];
        action: TimelineAction;
        row: TimelineRow;
        startLeft: number;
        scale: number;
        scaleWidth: number;
        hideCursor: boolean;
        cursorLeft: number;
    }) => number[];
    defaultGetMovePosition: (data: {
        start: number;
        end: number;
        dir?: "right" | "left";
        startLeft: number;
        scale: number;
        scaleWidth: number;
    }) => number[];
};
