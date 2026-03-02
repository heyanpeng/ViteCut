import { TimelineAction, TimelineRow } from '@xzdarcy/timeline-engine';
/** 时间转像素 */
export declare function parserTimeToPixel(data: number, param: {
    startLeft: number;
    scale: number;
    scaleWidth: number;
}): number;
/** 像素转时间 */
export declare function parserPixelToTime(data: number, param: {
    startLeft: number;
    scale: number;
    scaleWidth: number;
}): number;
/** 位置 + 宽度 转 start + end */
export declare function parserTransformToTime(data: {
    left: number;
    width: number;
}, param: {
    startLeft: number;
    scale: number;
    scaleWidth: number;
}): {
    start: number;
    end: number;
};
/** start + end 转 位置 + 宽度 */
export declare function parserTimeToTransform(data: {
    start: number;
    end: number;
}, param: {
    startLeft: number;
    scale: number;
    scaleWidth: number;
}): {
    left: number;
    width: number;
};
/** 根据数据获取刻度个数 */
export declare function getScaleCountByRows(data: TimelineRow[], param: {
    scale: number;
}): number;
/** 根据时间获取目前刻度数 */
export declare function getScaleCountByPixel(data: number, param: {
    startLeft: number;
    scaleWidth: number;
    scaleCount: number;
}): number;
/** 获取动作全部时间的位置集合 */
export declare function parserActionsToPositions(actions: TimelineAction[], param: {
    startLeft: number;
    scale: number;
    scaleWidth: number;
}): number[];
