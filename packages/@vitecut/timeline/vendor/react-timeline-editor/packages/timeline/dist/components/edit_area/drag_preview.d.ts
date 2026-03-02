import { FC } from 'react';
interface DragPreviewProps {
    /** 预览元素顶部位置 */
    top: number;
    /** 预览元素高度 */
    height: number;
    /** 预览元素是否可见 */
    visible: boolean;
}
/**
 * 拖拽预览组件 - 显示拖拽中的行预览
 */
export declare const DragPreview: FC<DragPreviewProps>;
export {};
