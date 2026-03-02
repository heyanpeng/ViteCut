import { FC } from 'react';
interface InsertionLineProps {
    /** 距离顶部高度 */
    top: number;
    /** 插入线是否可见 */
    visible: boolean;
}
/**
 * 插入线组件 - 显示拖拽插入位置
 */
export declare const InsertionLine: FC<InsertionLineProps>;
export {};
