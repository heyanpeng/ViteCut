import { useState, useEffect, useRef, useCallback } from 'react';
import type { RecordingHandle, RecordingResult } from '../recorder';

export type RecorderPhase = 'idle' | 'countdown' | 'recording' | 'paused' | 'stopped';

export type UseRecorderOptions = {
  /** 由调用方提供的录制启动函数，返回 RecordingHandle */
  startRecording: () => Promise<RecordingHandle>;
  /** 倒计时秒数，默认 3 */
  countdownSeconds?: number;
  /** 最大录制时长（ms），默认 15 分钟 */
  maxDurationMs?: number;
};

export type UseRecorderReturn = {
  phase: RecorderPhase;
  countdownRemaining: number;
  elapsedMs: number;
  stream: MediaStream | null;
  result: RecordingResult | null;
  startCountdown: () => void;
  cancelCountdown: () => void;
  stop: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  destroy: () => void;
};

/**
 * 通用录制状态机 React Hook。
 *
 * 不绑定具体录制类型，通过 startRecording 回调注入录制方式。
 * 管理倒计时、录制时长、状态转换等通用逻辑。
 *
 * @param options - 配置选项
 * @returns 录制状态、时长、stream、结果以及操作方法
 *
 * 示例：
 * ```ts
 * const recorder = useRecorder({
 *   startRecording: () => startAudioRecording({ constraints: { deviceId } }),
 *   maxDurationMs: 15 * 60 * 1000,
 * });
 * ```
 */
export function useRecorder(
  options: UseRecorderOptions,
): UseRecorderReturn {
  const { startRecording, countdownSeconds = 3, maxDurationMs = 15 * 60 * 1000 } = options;

  const [phase, setPhase] = useState<RecorderPhase>('idle');
  const [countdownRemaining, setCountdownRemaining] = useState(0);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [result, setResult] = useState<RecordingResult | null>(null);

  const handleRef = useRef<RecordingHandle | null>(null);
  const countdownTimerRef = useRef<number | null>(null);
  const elapsedTimerRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const phaseRef = useRef<RecorderPhase>('idle');
  const elapsedMsRef = useRef<number>(0);

  // 同步 phaseRef
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // 同步 elapsedMsRef，使 resume 不依赖 elapsedMs 状态
  useEffect(() => {
    elapsedMsRef.current = elapsedMs;
  }, [elapsedMs]);

  const cleanup = useCallback(() => {
    if (countdownTimerRef.current != null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    if (elapsedTimerRef.current != null) {
      cancelAnimationFrame(elapsedTimerRef.current);
      elapsedTimerRef.current = null;
    }
    if (handleRef.current) {
      handleRef.current.stream.getTracks().forEach((track: MediaStreamTrack) => track.stop());
      handleRef.current = null;
    }
    setStream(null);
  }, []);

  const startCountdown = useCallback(() => {
    if (phaseRef.current !== 'idle') {
      return;
    }

    setPhase('countdown');
    setCountdownRemaining(countdownSeconds);

    countdownTimerRef.current = window.setInterval(() => {
      setCountdownRemaining((prev: number) => {
        if (prev <= 1) {
          if (countdownTimerRef.current != null) {
            clearInterval(countdownTimerRef.current);
            countdownTimerRef.current = null;
          }
          // 倒计时结束，开始录制
          startRecording()
            .then((handle) => {
              handleRef.current = handle;
              setStream(handle.stream);
              setPhase('recording');
              startTimeRef.current = performance.now();
              setElapsedMs(0);
            })
            .catch((err) => {
              console.error('启动录制失败:', err);
              setPhase('idle');
              cleanup();
            });
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [countdownSeconds, startRecording, cleanup]);

  const cancelCountdown = useCallback(() => {
    if (phaseRef.current !== 'countdown') {
      return;
    }
    if (countdownTimerRef.current != null) {
      clearInterval(countdownTimerRef.current);
      countdownTimerRef.current = null;
    }
    setPhase('idle');
    setCountdownRemaining(0);
  }, []);

  const stop = useCallback(async () => {
    if (phaseRef.current !== 'recording' && phaseRef.current !== 'paused') {
      return;
    }
    if (handleRef.current) {
      const res = await handleRef.current.stop();
      setResult(res);
      setPhase('stopped');
      cleanup();
    }
  }, [cleanup]);

  const pause = useCallback(() => {
    if (phaseRef.current !== 'recording') {
      return;
    }
    if (handleRef.current) {
      handleRef.current.pause();
      setPhase('paused');
      if (elapsedTimerRef.current != null) {
        cancelAnimationFrame(elapsedTimerRef.current);
        elapsedTimerRef.current = null;
      }
    }
  }, []);

  const resume = useCallback(() => {
    if (phaseRef.current !== 'paused') {
      return;
    }
    if (handleRef.current) {
      handleRef.current.resume();
      setPhase('recording');
      startTimeRef.current = performance.now() - elapsedMsRef.current;
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    phaseRef.current = 'idle';
    setPhase('idle');
    setCountdownRemaining(0);
    setElapsedMs(0);
    setResult(null);
  }, [cleanup]);

  // destroy 与 reset 语义一致，保留兼容性
  const destroy = reset;

  // 清理 effect
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, [cleanup]);

  // 录制时长追踪（仅在 recording 阶段）
  useEffect(() => {
    if (phase === 'recording' && handleRef.current) {
      const updateElapsed = () => {
        if (handleRef.current && phaseRef.current === 'recording') {
          const elapsed = performance.now() - startTimeRef.current;
          setElapsedMs(elapsed);

          if (elapsed >= maxDurationMs) {
            handleRef.current.stop().then((res) => {
              setResult(res);
              setPhase('stopped');
              cleanup();
            });
          } else {
            elapsedTimerRef.current = requestAnimationFrame(updateElapsed);
          }
        }
      };
      elapsedTimerRef.current = requestAnimationFrame(updateElapsed);
      return () => {
        if (elapsedTimerRef.current != null) {
          cancelAnimationFrame(elapsedTimerRef.current);
          elapsedTimerRef.current = null;
        }
      };
    }
  }, [phase, maxDurationMs, cleanup]);

  return {
    phase,
    countdownRemaining,
    elapsedMs,
    stream,
    result,
    startCountdown,
    cancelCountdown,
    stop,
    pause,
    resume,
    reset,
    destroy,
  };
}
