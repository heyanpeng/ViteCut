declare module "mediabunny" {
  // 仅声明应用当前用到的极少数 API，类型细节交给 mediabunny 自身的 d.ts。

  export interface VideoTrack {
    displayWidth: number;
    displayHeight: number;
    rotation: number;
    codec?: string | null;
  }

  export interface AudioTrack {
    sampleRate: number;
    numberOfChannels: number;
    codec?: string | null;
  }

  export class Input {
    constructor(options: unknown);
    getPrimaryVideoTrack(): Promise<VideoTrack | null>;
    getPrimaryAudioTrack(): Promise<AudioTrack | null>;
  }

  export type WrappedAudioBuffer = {
    buffer: AudioBuffer;
    timestamp: number;
    duration: number;
  };

  export class AudioBufferSink {
    constructor(audioTrack: unknown);
    buffers(
      startTimestamp?: number,
      endTimestamp?: number
    ): AsyncGenerator<WrappedAudioBuffer, void, unknown>;
  }

  export interface CanvasSinkOptions {
    width?: number;
    height?: number;
    fit?: "fill" | "contain" | "cover";
    poolSize?: number;
  }

  export interface WrappedCanvas {
    canvas: HTMLCanvasElement | OffscreenCanvas;
    timestamp: number;
    duration: number;
  }

  export class CanvasSink {
    constructor(videoTrack: unknown, options?: CanvasSinkOptions);
    getCanvas(timestamp: number): Promise<WrappedCanvas | null>;
    canvases(
      startTimestamp?: number,
      endTimestamp?: number
    ): AsyncGenerator<WrappedCanvas, void, unknown>;
  }
}
