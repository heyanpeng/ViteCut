import React, { PointerEvent, ReactNode } from "react";
import type { TimelineAction } from "./types";
import "./ClipItem.css";
/**
 * ClipItemProps 定义时间线片段的属性类型
 */
type ClipItemProps = {
    clip: TimelineAction;
    renderClip: TimelineAction;
    left: number;
    top: number;
    width: number;
    height: number;
    isSelected: boolean;
    isDraggedSource: boolean;
    isDimmed: boolean;
    content?: ReactNode;
    onPointerDown: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
    onClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onDoubleClick: (event: React.MouseEvent<HTMLDivElement>) => void;
    onTrimPointerDown: (event: PointerEvent<HTMLDivElement>, side: "left" | "right") => void;
    onTrimPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onTrimPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
};
/**
 * 时间线片段组件
 */
export declare const ClipItem: React.FC<ClipItemProps>;
export {};
