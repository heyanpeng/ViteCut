import React, { PointerEvent, ReactNode } from "react";
import type { TimelineAction } from "./types";
import "./DragPreview.css";
type DragPreviewProps = {
    clip: TimelineAction;
    left: number;
    top: number;
    width: number;
    height: number;
    isDropValid: boolean;
    content?: ReactNode;
    onPointerMove: (event: PointerEvent<HTMLDivElement>) => void;
    onPointerUp: (event: PointerEvent<HTMLDivElement>) => void;
};
export declare const DragPreview: React.FC<DragPreviewProps>;
export {};
