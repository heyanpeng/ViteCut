import { FC } from 'react';
import { OnScrollParams } from 'react-virtualized';
import { CommonProp } from '../../interface/common_prop';
/** 动画时间轴组件参数 */
export type TimeAreaProps = CommonProp & {
    /** 左侧滚动距离 */
    scrollLeft: number;
    /** 滚动回调，用于同步滚动 */
    onScroll: (params: OnScrollParams) => void;
    /** 设置光标位置 */
    setCursor: (param: {
        left?: number;
        time?: number;
    }) => void;
};
/** 动画时间轴组件 */
export declare const TimeArea: FC<TimeAreaProps>;
