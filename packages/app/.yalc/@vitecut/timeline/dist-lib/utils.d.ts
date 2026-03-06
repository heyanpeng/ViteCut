import type { TimelineAction } from "./types";
/**
 * 将时间值（秒）转换为像素值
 * @param time - 时间（秒）
 * @param zoom - 缩放比例
 * @param basePxPerSecond - 每秒像素数（默认 BASE_PX_PER_SECOND）
 * @returns 对应的像素值
 */
export declare const timeToPixel: (time: number, zoom: number, basePxPerSecond?: number) => number;
/**
 * 将像素值转换为时间值（秒）
 * @param pixel - 像素
 * @param zoom - 缩放比例
 * @param basePxPerSecond - 每秒像素数（默认 BASE_PX_PER_SECOND）
 * @returns 对应的时间（秒）
 */
export declare const pixelToTime: (pixel: number, zoom: number, basePxPerSecond?: number) => number;
/**
 * 限制数值在指定[min, max]区间内
 * @param value - 需要限制的数值
 * @param min - 最小值
 * @param max - 最大值
 * @returns 被限制区间后的数值
 */
export declare const clamp: (value: number, min: number, max: number) => number;
/**
 * 计算时间线主/次刻度间隔（单位：秒及毫秒）
 * @param pxPerSecond - 每秒对应的像素数
 * @returns major（主刻度秒数），minor（次刻度秒数），以及对应单位等
 */
export declare const getTickStepSeconds: (pxPerSecond: number) => {
    major: number;
    minor: number;
    majorMs: number;
    minorMs: number;
    unit: "subsecond" | "second";
};
/**
 * 时间格式化，显示为 mm:ss 或 hh:mm:ss
 * @param time - 时间（秒）
 * @returns 格式化字符串
 */
export declare const formatTime: (time: number) => string;
/**
 * 时间格式化，显示为 mm:ss.SSS 或 hh:mm:ss.SSS（带毫秒）
 * @param time - 时间（秒）
 * @returns 格式化字符串
 */
export declare const formatTimeWithMs: (time: number) => string;
/**
 * 获取 action 的时长（秒），保证不为负数
 * @param action - 时间线 Action
 */
export declare const getActionDuration: (action: TimelineAction) => number;
/**
 * 根据 Action 类型返回图标
 * @param action - 时间线 Action
 * @returns 图标字符串（emoji 或字母）
 */
export declare const getClipIcon: (action: TimelineAction) => string;
/**
 * 获取剪辑 label（优先标题，无则取 ID）
 * @param action - 时间线 Action
 * @returns label 字符串
 */
export declare const getClipLabel: (action: TimelineAction) => string;
/**
 * 根据 Action 类型获取剪辑颜色（如果有自定义 color 优先用自定义的）
 * @param action - 时间线 Action
 * @returns 颜色字符串（十六进制）
 */
export declare const getClipColor: (action: TimelineAction) => string;
/**
 * 框架数与时间/像素简写（兼容旧用法）
 */
export declare const frameToPixel: (time: number, zoom: number, basePxPerSecond?: number) => number;
export declare const pixelToFrame: (pixel: number, zoom: number, basePxPerSecond?: number) => number;
