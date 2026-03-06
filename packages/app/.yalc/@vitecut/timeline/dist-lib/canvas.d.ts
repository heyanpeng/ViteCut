import type { TrackLayout } from "./types";
type CommonDraw = {
    canvas: HTMLCanvasElement;
    viewportWidth: number;
    viewportHeight: number;
    scrollLeft: number;
    scrollTop: number;
    zoom: number;
    duration: number;
    showMinorTicks: boolean;
};
/**
 * 绘制时间线主画布，包括背景、轨道水平线(可选)、时间刻度线
 */
export declare const drawTimelineCanvas: ({ canvas, viewportWidth, viewportHeight, scrollLeft, scrollTop, zoom, duration, showMinorTicks, showHorizontalLines, trackLayouts, }: CommonDraw & {
    showHorizontalLines: boolean;
    trackLayouts: TrackLayout[];
}) => void;
/**
 * 绘制标尺（顶部的时间刻度带和标签）
 */
export declare const drawRulerCanvas: ({ canvas, viewportWidth, scrollLeft, scrollTop: _scrollTop, zoom, duration, showMinorTicks, }: CommonDraw) => void;
export {};
