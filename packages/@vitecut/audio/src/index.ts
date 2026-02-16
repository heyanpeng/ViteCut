/**
 * 基于 Web Audio API 的简单音频时间轴播放器。
 *
 * 仅在浏览器环境下可用。工程数据结构由 @vitecut/project 提供，这里只关心
 * 已经解码好的 AudioBuffer 以及它们在时间轴上的位置。
 */

export interface AudioClipConfig {
  id: string;
  buffer: AudioBuffer;
  /**
   * 在工程时间轴上的起始时间（秒）
   */
  start: number;
  end: number;
  /**
   * 在 buffer 内部的裁剪入点 / 出点（秒）
   */
  inPoint?: number;
  outPoint?: number;
  /**
   * 初始音量（0-1）
   */
  gain?: number;
}

export interface AudioTimelineConfig {
  clips: AudioClipConfig[];
}

export class AudioEngine {
  private audioContext: AudioContext | null = null;
  private currentSources: Map<
    string,
    { source: AudioBufferSourceNode; gainNode: GainNode }
  > = new Map();
  private _isPlaying = false;
  private _startTime = 0;
  private _offset = 0;

  get isPlaying(): boolean {
    return this._isPlaying;
  }

  /**
   * 惰性创建 AudioContext，避免在非用户交互时被浏览器拦截。
   */
  private ensureContext(): AudioContext {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }
    return this.audioContext;
  }

  /**
   * 从 URL 加载并解码 AudioBuffer。
   * 解码更复杂的格式可以交给 @vitecut/media，再将解码后的 PCM 交给这里。
   */
  async loadBufferFromUrl(url: string): Promise<AudioBuffer> {
    const ctx = this.ensureContext();
    const res = await fetch(url);
    const arrayBuffer = await res.arrayBuffer();
    return ctx.decodeAudioData(arrayBuffer);
  }

  /**
   * 播放给定的时间轴配置，从 time 秒开始。
   */
  play(timeline: AudioTimelineConfig, time: number = 0): void {
    const ctx = this.ensureContext();

    this.stop();

    this._isPlaying = true;
    this._startTime = ctx.currentTime;
    this._offset = time;

    for (const clip of timeline.clips) {
      const { id, buffer, start, end, inPoint = 0, outPoint, gain = 1 } = clip;

      const clipDuration = (outPoint ?? buffer.duration) - inPoint;
      if (clipDuration <= 0) continue;

      // 当前播放窗口内才创建 source
      if (time > end || time < start - clipDuration) continue;

      const source = ctx.createBufferSource();
      source.buffer = buffer;

      const gainNode = ctx.createGain();
      gainNode.gain.value = gain;

      source.connect(gainNode);
      gainNode.connect(ctx.destination);

      const offsetInClip = Math.max(0, time - start);
      const when = ctx.currentTime;
      const duration = Math.min(clipDuration - offsetInClip, end - time);

      source.start(when, inPoint + offsetInClip, duration);

      this.currentSources.set(id, { source, gainNode });
    }
  }

  pause(): void {
    if (!this._isPlaying || !this.audioContext) return;
    const ctx = this.audioContext;

    this._offset += ctx.currentTime - this._startTime;

    this.stop();
  }

  stop(): void {
    this._isPlaying = false;

    this.currentSources.forEach(({ source, gainNode }) => {
      try {
        source.stop();
      } catch {
        // ignore
      }
      source.disconnect();
      gainNode.disconnect();
    });
    this.currentSources.clear();
  }

  /**
   * 获取当前理论上的播放时间（不考虑实际 source 结束情况）。
   */
  getCurrentTime(): number {
    if (!this.audioContext || !this._isPlaying) return this._offset;
    return this._offset + (this.audioContext.currentTime - this._startTime);
  }
}
