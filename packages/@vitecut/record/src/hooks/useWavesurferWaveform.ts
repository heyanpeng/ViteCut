import { useEffect, useRef } from "react";
import type { RefObject } from "react";
import WaveSurfer from "wavesurfer.js";
// RecordPlugin 来自 dist 路径，类型与 BasePlugin 不完全兼容，使用类型断言
import RecordPluginImport from "wavesurfer.js/dist/plugins/record.esm.js";
const RecordPlugin = RecordPluginImport as {
  create: (opts?: { scrollingWaveform?: boolean }) => {
    renderMicStream: (stream: MediaStream) => { onDestroy: () => void };
  };
};

export type UseWavesurferWaveformOptions = {
  /** 波形颜色，默认 '#9ca3af'（灰色） */
  waveColor?: string;
  /** 进度颜色，默认与 waveColor 相同 */
  progressColor?: string;
  /** 波形条宽度，默认 2 */
  barWidth?: number;
  /** 波形条高度比例，默认 1 */
  barHeight?: number;
  /** 波形条间距，null 表示自动计算 */
  barGap?: number | null;
  /** 是否可交互，默认 false */
  interact?: boolean;
  /** 光标宽度，默认 0 */
  cursorWidth?: number;
};

/**
 * 使用 wavesurfer.js Record 插件显示实时音频波形（bars 样式）。
 *
 * 使用 Record 插件的 renderMicStream 方法来实时显示 MediaStream 的波形。
 *
 * @param containerRef - 容器的 ref（div 元素）
 * @param stream - 包含音频轨道的 MediaStream，为 null 时停止可视化
 * @param options - wavesurfer 配置选项
 *
 * 示例：
 * ```ts
 * const containerRef = useRef<HTMLDivElement>(null);
 * useWavesurferWaveform(containerRef, recorder.stream, {
 *   waveColor: recorder.phase === 'recording' ? '#4ade80' : '#9ca3af',
 *   barWidth: 2,
 *   barHeight: 1,
 * });
 * ```
 */
export function useWavesurferWaveform(
  containerRef: RefObject<HTMLDivElement | null>,
  stream: MediaStream | null,
  options: UseWavesurferWaveformOptions = {}
): void {
  const {
    waveColor = "#9ca3af",
    progressColor,
    barWidth = 2,
    barHeight = 1,
    barGap = null,
    interact = false,
    cursorWidth = 0,
  } = options;

  const wavesurferRef = useRef<any>(null);
  const recordPluginRef = useRef<any>(null);
  const micStreamRef = useRef<any>(null);

  // 初始化 wavesurfer 实例
  useEffect(() => {
    if (!containerRef.current) {
      return;
    }

    // 创建 Record 插件（scrollingWaveform: false 表示波形原地刷新，不从左向右滚动）
    const recordPlugin = RecordPlugin.create({
      scrollingWaveform: false,
    });

    // 创建 wavesurfer 实例（height: 'auto' 让 canvas 高度撑满容器）
    const wavesurfer = WaveSurfer.create({
      container: containerRef.current,
      height: "auto",
      fillParent: true,
      waveColor,
      progressColor: progressColor || waveColor,
      barWidth,
      barHeight,
      barGap: barGap ?? undefined,
      interact,
      cursorWidth,
      plugins: [recordPlugin as never],
    });

    wavesurferRef.current = wavesurfer;
    recordPluginRef.current = recordPlugin;

    // 清理函数
    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.onDestroy();
        micStreamRef.current = null;
      }
      if (wavesurferRef.current) {
        wavesurferRef.current.destroy();
        wavesurferRef.current = null;
      }
      recordPluginRef.current = null;
    };
  }, [
    containerRef,
    waveColor,
    progressColor,
    barWidth,
    barHeight,
    barGap,
    interact,
    cursorWidth,
  ]);

  // 处理 stream 变化
  useEffect(() => {
    if (!stream || !wavesurferRef.current || !recordPluginRef.current) {
      // 清理
      if (micStreamRef.current) {
        micStreamRef.current.onDestroy();
        micStreamRef.current = null;
      }
      return;
    }

    // 使用 Record 插件的 renderMicStream 方法
    const micStream = recordPluginRef.current.renderMicStream(stream);
    micStreamRef.current = micStream;

    return () => {
      if (micStreamRef.current) {
        micStreamRef.current.onDestroy();
        micStreamRef.current = null;
      }
    };
  }, [stream]);

  // 更新颜色配置
  useEffect(() => {
    if (wavesurferRef.current) {
      wavesurferRef.current.setOptions({
        waveColor,
        progressColor: progressColor || waveColor,
      });
    }
  }, [waveColor, progressColor]);
}
