import { DraggableOptions } from '@interactjs/actions/drag/plugin';
import { ResizableOptions } from '@interactjs/actions/resize/plugin';
import { Interactable } from '@interactjs/types';
import { FC, ReactElement } from 'react';
interface InteractCompProps {
    children: ReactElement;
    interactRef: React.MutableRefObject<Interactable | null>;
    draggable: boolean;
    draggableOptions: DraggableOptions;
    resizable: boolean;
    resizableOptions: ResizableOptions;
}
export declare const InteractComp: FC<InteractCompProps>;
export {};
