import { TimelineRow } from '@xzdarcy/timeline-engine';

/**
 * 计算行的累计高度
 * @param editorData 编辑器数据
 * @param rowIndex 目标行索引
 * @param defaultRowHeight 默认行高
 * @returns 累计高度
 */
export const calculateRowAccumulatedHeight = (
  editorData: TimelineRow[],
  rowIndex: number,
  defaultRowHeight: number
): number => {
  let accumulatedHeight = 0;
  for (let i = 0; i < rowIndex; i++) {
    accumulatedHeight += editorData[i]?.rowHeight || defaultRowHeight;
  }
  return accumulatedHeight;
};

/**
 * 计算所有行的总高度
 * @param editorData 编辑器数据
 * @param defaultRowHeight 默认行高
 * @returns 总高度
 */
export const calculateTotalHeight = (
  editorData: TimelineRow[],
  defaultRowHeight: number
): number => {
  return editorData.reduce((total, row) => total + (row?.rowHeight || defaultRowHeight), 0);
};

/**
 * 获取每行的实际高度数组
 * @param editorData 编辑器数据
 * @param defaultRowHeight 默认行高
 * @returns 高度数组
 */
export const getRowHeights = (
  editorData: TimelineRow[],
  defaultRowHeight: number
): number[] => {
  return editorData.map(row => row?.rowHeight || defaultRowHeight);
};

/**
 * 计算插入线的位置
 * @param editorData 编辑器数据
 * @param targetIndex 目标索引
 * @param defaultRowHeight 默认行高
 * @returns 插入线顶部位置
 */
export const calculateInsertionLineTop = (
  editorData: TimelineRow[],
  targetIndex: number,
  defaultRowHeight: number
): number => {
  return calculateRowAccumulatedHeight(editorData, targetIndex, defaultRowHeight);
};

/**
 * 验证拖拽目标索引是否有效
 * @param targetIndex 目标索引
 * @param draggedIndex 被拖拽行索引
 * @param totalRows 总行数
 * @returns 是否有效
 */
export const isValidDragTarget = (
  targetIndex: number,
  draggedIndex: number,
  totalRows: number
): boolean => {
  // 允许拖拽到最后一行（targetIndex = totalRows）
  return targetIndex >= 0 && targetIndex <= totalRows && targetIndex !== draggedIndex;
};