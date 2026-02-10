declare module "mediabunny" {
  // 仅声明应用当前用到的极少数 API，类型细节交给 mediabunny 自身的 d.ts。

  export class Input {
    constructor(options: unknown);
    getPrimaryVideoTrack(): Promise<unknown>;
  }

  export interface CanvasSinkOptions {
    width?: number;
    height?: number;
    fit?: "fill" | "contain" | "cover";
  }

  export interface WrappedCanvas {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    timestamp: number;
    duration: number;
  }

  export class CanvasSink {
    constructor(videoTrack: unknown, options?: CanvasSinkOptions);
    getCanvas(timestamp: number): Promise<WrappedCanvas | null>;
  }
}

