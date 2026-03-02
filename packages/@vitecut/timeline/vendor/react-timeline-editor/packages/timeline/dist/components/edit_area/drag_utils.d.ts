import { TimelineRow } from '@xzdarcy/timeline-engine';
/**
 * 计算行的累计高度
 * @param editorData 编辑器数据
 * @param rowIndex 目标行索引
 * @param defaultRowHeight 默认行高
 * @returns 累计高度
 */
export declare const calculateRowAccumulatedHeight: (editorData: TimelineRow[], rowIndex: number, defaultRowHeight: number) => number;
/**
 * 计算所有行的总高度
 * @param editorData 编辑器数据
 * @param defaultRowHeight 默认行高
 * @returns 总高度
 */
export declare const calculateTotalHeight: (editorData: TimelineRow[], defaultRowHeight: number) => number;
/**
 * 获取每行的实际高度数组
 * @param editorData 编辑器数据
 * @param defaultRowHeight 默认行高
 * @returns 高度数组
 */
export declare const getRowHeights: (editorData: TimelineRow[], defaultRowHeight: number) => number[];
/**
 * 计算插入线的位置
 * @param editorData 编辑器数据
 * @param targetIndex 目标索引
 * @param defaultRowHeight 默认行高
 * @returns 插入线顶部位置
 */
export declare const calculateInsertionLineTop: (editorData: TimelineRow[], targetIndex: number, defaultRowHeight: number) => number;
/**
 * 验证拖拽目标索引是否有效
 * @param targetIndex 目标索引
 * @param draggedIndex 被拖拽行索引
 * @param totalRows 总行数
 * @returns 是否有效
 */
export declare const isValidDragTarget: (targetIndex: number, draggedIndex: number, totalRows: number) => boolean;
