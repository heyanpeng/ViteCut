import { default as React, FC } from 'react';
import { ScrollSync } from 'react-virtualized';
import { CommonProp } from '../../interface/common_prop';
/** 动画时间轴组件参数 */
export type CursorProps = CommonProp & {
    /** 距离左侧滚动距离 */
    scrollLeft: number;
    /** 设置光标位置 */
    setCursor: (param: {
        left?: number;
        time?: number;
    }) => boolean;
    /** 时间轴区域dom ref */
    areaRef: React.RefObject<HTMLDivElement>;
    /** 设置scroll left */
    deltaScrollLeft?: (delta: number) => void;
    /** 滚动同步ref（TODO: 该数据用于临时解决scrollLeft拖住时不同步问题） */
    scrollSync: React.RefObject<ScrollSync>;
};
export declare const Cursor: FC<CursorProps>;
