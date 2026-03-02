import { default as React } from 'react';
import { OnScrollParams } from 'react-virtualized';
import { TimelineRow } from '@xzdarcy/timeline-engine';
import { CommonProp } from '../../interface/common_prop';
export type EditAreaProps = CommonProp & {
    /** 距离左侧滚动距离 */
    scrollLeft: number;
    /** 距离顶部滚动距离 */
    scrollTop: number;
    /** 滚动回调，用于同步滚动 */
    onScroll: (params: OnScrollParams) => void;
    /** 设置编辑器数据 */
    setEditorData: (params: TimelineRow[]) => void;
    /** 设置scroll left */
    deltaScrollLeft: (scrollLeft: number) => void;
};
/** edit area ref数据 */
export interface EditAreaState {
    domRef: React.MutableRefObject<HTMLDivElement | null>;
}
export declare const EditArea: React.ForwardRefExoticComponent<CommonProp & {
    /** 距离左侧滚动距离 */
    scrollLeft: number;
    /** 距离顶部滚动距离 */
    scrollTop: number;
    /** 滚动回调，用于同步滚动 */
    onScroll: (params: OnScrollParams) => void;
    /** 设置编辑器数据 */
    setEditorData: (params: TimelineRow[]) => void;
    /** 设置scroll left */
    deltaScrollLeft: (scrollLeft: number) => void;
} & React.RefAttributes<EditAreaState>>;
