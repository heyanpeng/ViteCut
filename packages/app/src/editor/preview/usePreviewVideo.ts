import { useEffect, useRef, useState, type RefObject } from "react";
import type { CanvasEditor } from "@swiftav/canvas";
import { CanvasSink, type Input, type WrappedCanvas } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { useProjectStore } from "@/stores";
import { getActiveVideoClips } from "./utils";

/**
 * usePreviewVideo
 * 用于视频预览逻辑，根据 project 创建 CanvasSink 和 Input，自动管理同步每个片段的单帧视频画布，支持编辑器静止和播放两种模式。
 * - 播放前准备所有视频 asset 的 sink
 * - 播放时用 rAF 定时拉取下一帧并渲染
 * - 静止时支持单帧拉取
 */
export function usePreviewVideo(
  editorRef: RefObject<CanvasEditor | null>,
  rafIdRef: RefObject<number | null>,
): void {
  // 状态选择器，获取项目、当前时间、播放控制等
  const project = useProjectStore((s) => s.project);
  const currentTime = useProjectStore((s) => s.currentTime);
  const isPlaying = useProjectStore((s) => s.isPlaying);
  const duration = useProjectStore((s) => s.duration);
  const setCurrentTime = useProjectStore((s) => s.setCurrentTime);
  const setIsPlaying = useProjectStore((s) => s.setIsPlaying);

  // 存储每个视频 asset 的 input 和 sink
  const sinksByAssetRef = useRef<
    Map<string, { input: Input; sink: CanvasSink }>
  >(new Map());
  // 存储每个片段对应的 canvas 元素
  const clipCanvasesRef = useRef<Map<string, HTMLCanvasElement>>(new Map());
  // 当前已经添加到编辑器的视频片段 id 集合
  const syncedVideoClipIdsRef = useRef<Set<string>>(new Set());
  // 当前拉取帧的时间点（用于异步判断帧是否过期）
  const videoFrameRequestTimeRef = useRef(0);
  // 播放时的 clip iterator 迭代器（每个 clip 一个）
  const clipIteratorsRef = useRef<
    Map<string, AsyncGenerator<WrappedCanvas, void, unknown>>
  >(new Map());
  // 每个 clip 预拉的下一帧（用于准确帧步进计算）
  const clipNextFrameRef = useRef<Map<string, WrappedCanvas | null>>(new Map());

  // project 当前快照（避免闭包引发过期引用问题）
  const projectRef = useRef<typeof project>(null);
  // 是否处于播放状态的 ref
  const isPlayingRef = useRef(false);
  // 开始播放时的时间点
  const playbackTimeAtStartRef = useRef(0);
  // 对应 wall-clock 的起点秒数
  const wallStartRef = useRef(0);
  // 项目时长 ref
  const durationRef = useRef(0);

  // 表示 sink 建立是否完成的 tick（变更时强制同步 canvas 帧）
  const [sinksReadyTick, setSinksReadyTick] = useState(0);

  // 更新 isPlayingRef
  useEffect(() => {
    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  // 更新 durationRef 保证 duration 非闭包引用
  useEffect(() => {
    durationRef.current = duration;
  }, [duration]);

  // 更新 projectRef 保证 project 非闭包引用
  useEffect(() => {
    projectRef.current = project;
  }, [project]);

  // 非播放状态记录开始播放的时间点，方便计算 wall-clock 进度
  useEffect(() => {
    if (!isPlaying) {
      playbackTimeAtStartRef.current = currentTime;
    }
  }, [isPlaying, currentTime]);

  /**
   * 监听 project 变更：为每个视频 asset 创建 Input + CanvasSink。
   * 成功后 setSinksReadyTick 触发当前帧同步。
   * 清理时移除所有视频片段与 sinks。
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor) {
      return;
    }
    // 无 project 时，直接移除所有已有视频片段和 sinks
    if (!project) {
      for (const id of syncedVideoClipIdsRef.current) {
        editor.removeVideo(id);
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();
      return;
    }

    // 获取舞台尺寸
    const stageSize = editor.getStage().size();
    const width = Math.max(1, Math.round(stageSize.width));
    const height = Math.max(1, Math.round(stageSize.height));
    // 获取所有有 source 的视频 asset
    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );

    let cancelled = false;

    // 并发 setup，逐个为每个 asset 创建 sink
    const setup = async () => {
      // 先清空已经同步的视频片段
      for (const id of syncedVideoClipIdsRef.current) {
        editor.removeVideo(id);
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();

      for (const asset of videoAssets) {
        if (cancelled) {
          return;
        }
        try {
          const input = createInputFromUrl(asset.source);
          const videoTrack = await input.getPrimaryVideoTrack();
          if (!videoTrack || cancelled) {
            return;
          }
          const sink = new CanvasSink(videoTrack, {
            width,
            height,
            fit: "cover", // 按 cover 适配
            poolSize: 2, // 缓存池大小
          });
          sinksByAssetRef.current.set(asset.id, { input, sink });
        } catch {
          // 创建单个 asset 失败不影响整体流程
        }
      }
      if (!cancelled) {
        // sinks 准备好，通知同步首帧
        setSinksReadyTick((c) => c + 1);
      }
    };

    void setup();

    // 清理时标记 cancelled，彻底移除所有片段与 sinks
    return () => {
      cancelled = true;
      const ed = editorRef.current;
      if (ed) {
        for (const id of syncedVideoClipIdsRef.current) {
          ed.removeVideo(id);
        }
      }
      syncedVideoClipIdsRef.current.clear();
      clipCanvasesRef.current.clear();
      sinksByAssetRef.current.clear();
    };
  }, [editorRef, project]);

  /**
   * 监听 currentTime/sinksReadyTick：同步当前时刻所有可见视频片段。
   * 非播放状态下请求 getCanvas 拉取精准单帧并渲染；删除不再可见的片段和清理资源。
   */
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !project) {
      return;
    }

    const t = currentTime;
    // 获取当前时刻所有活跃的视频片段
    const active = getActiveVideoClips(project, t);
    // 舞台尺寸
    const stageSize = editor.getStage().size();
    const stageW = Math.max(1, Math.round(stageSize.width));
    const stageH = Math.max(1, Math.round(stageSize.height));

    videoFrameRequestTimeRef.current = t;
    const requestTime = t;

    // 计算哪些 clip 需要移除
    const visibleIds = new Set(active.map((a) => a.clip.id));
    for (const id of syncedVideoClipIdsRef.current) {
      if (!visibleIds.has(id)) {
        editor.removeVideo(id);
        syncedVideoClipIdsRef.current.delete(id);
        clipCanvasesRef.current.delete(id);
        clipIteratorsRef.current.delete(id);
        clipNextFrameRef.current.delete(id);
      }
    }

    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) {
        continue;
      }

      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (t - clip.start);
      // 片段在舞台上的参数
      const x = clip.transform?.x ?? 0;
      const y = clip.transform?.y ?? 0;
      const scaleX = clip.transform?.scaleX ?? 1;
      const scaleY = clip.transform?.scaleY ?? 1;
      const w = stageW * scaleX;
      const h = stageH * scaleY;

      let canvas = clipCanvasesRef.current.get(clip.id);
      if (!canvas) {
        // 尚未挂载，创建新的 canvas
        canvas = document.createElement("canvas");
        canvas.width = stageW;
        canvas.height = stageH;
        clipCanvasesRef.current.set(clip.id, canvas);
        editor.addVideo({
          id: clip.id,
          video: canvas,
          x,
          y,
          width: w,
          height: h,
        });
        syncedVideoClipIdsRef.current.add(clip.id);
      }

      // 非播放状态下才拉单帧，播放状态交由 iterator/rAF 处理
      if (isPlayingRef.current) {
        continue;
      }

      sinkEntry.sink
        .getCanvas(sourceTime)
        .then((wrapped) => {
          // 若该帧已被新的请求覆盖则丢弃
          if (!wrapped || videoFrameRequestTimeRef.current !== requestTime) {
            return;
          }
          const frameCanvas = wrapped.canvas as HTMLCanvasElement;
          const ctx = canvas!.getContext("2d");
          if (!ctx) {
            return;
          }
          ctx.clearRect(0, 0, canvas!.width, canvas!.height);
          ctx.drawImage(frameCanvas, 0, 0, canvas!.width, canvas!.height);
          editor.getStage().batchDraw();
        })
        .catch(() => {
          /* 忽略异常 */
        });
    }
  }, [editorRef, project, currentTime, sinksReadyTick]);

  /**
   * 播放开始时初始化所有可见片段的 iterator，并预取前两帧（便于顺滑步进渲染）。
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    const proj = projectRef.current;
    const editor = editorRef.current;
    if (!proj || !editor) {
      return;
    }

    // 拉取当前时间，存作播放开始点
    const t0 = useProjectStore.getState().currentTime;
    playbackTimeAtStartRef.current = t0;
    wallStartRef.current = performance.now() / 1000;
    clipIteratorsRef.current.clear();
    clipNextFrameRef.current.clear();

    // 获取播放起始时刻所有活跃片段，逐个建立 iterator 并预拉两帧
    const active = getActiveVideoClips(proj, t0);
    for (const { clip, asset } of active) {
      const sinkEntry = sinksByAssetRef.current.get(asset.id);
      if (!sinkEntry) {
        continue;
      }
      const inPoint = clip.inPoint ?? 0;
      const sourceTime = inPoint + (t0 - clip.start);
      void (async () => {
        const it = sinkEntry.sink.canvases(sourceTime);
        clipIteratorsRef.current.set(clip.id, it);
        const first = (await it.next()).value ?? null;
        const second = (await it.next()).value ?? null;
        clipNextFrameRef.current.set(clip.id, second);
        const canvas = clipCanvasesRef.current.get(clip.id);
        if (first && canvas) {
          const ctx = canvas.getContext("2d");
          if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(
              first.canvas as HTMLCanvasElement,
              0,
              0,
              canvas.width,
              canvas.height,
            );
          }
          editor.getStage().batchDraw();
        }
      })();
    }
  }, [editorRef, isPlaying]);

  /**
   * 播放期间 rAF 主循环：
   * - 动态计算 playbackTime
   * - 消耗已预取的 nextFrame
   * - 主动 setCurrentTime，片尾自动停止播放
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    /**
     * 获取当前 wall-clock 下的播放帧时间
     */
    const getPlaybackTime = (): number => {
      return (
        performance.now() / 1000 -
        wallStartRef.current +
        playbackTimeAtStartRef.current
      );
    };

    /**
     * 拉取下一帧封装，存入 clipNextFrameRef
     */
    const updateNextFrame = (clipId: string) => {
      const it = clipIteratorsRef.current.get(clipId);
      if (!it) {
        return;
      }
      void it.next().then((result) => {
        const value = result.value ?? null;
        clipNextFrameRef.current.set(clipId, value);
      });
    };

    /**
     * 主循环：刷新当前帧、管理帧预拉与渲染、控制播放到结尾停播
     */
    const render = () => {
      const dur = durationRef.current;
      const playbackTime = getPlaybackTime();
      const proj = projectRef.current;
      const editor = editorRef.current;

      if (proj && editor) {
        const active = getActiveVideoClips(proj, playbackTime);
        for (const { clip } of active) {
          const inPoint = clip.inPoint ?? 0;
          const sourceTime = inPoint + (playbackTime - clip.start);
          const nextFrame = clipNextFrameRef.current.get(clip.id);
          // 预拉帧的时间戳 <= 当前要显示的 sourceTime 时消耗该帧
          if (nextFrame && nextFrame.timestamp <= sourceTime) {
            clipNextFrameRef.current.set(clip.id, null);
            const canvas = clipCanvasesRef.current.get(clip.id);
            if (canvas) {
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(
                  nextFrame.canvas as HTMLCanvasElement,
                  0,
                  0,
                  canvas.width,
                  canvas.height,
                );
              }
              editor.getStage().batchDraw();
            }
            updateNextFrame(clip.id);
          }
        }
      }

      // 到达片尾停播（避免超过 duration）
      if (playbackTime >= dur && dur > 0) {
        setIsPlaying(false);
        setCurrentTime(dur);
        playbackTimeAtStartRef.current = dur;
      } else {
        setCurrentTime(playbackTime);
      }

      rafIdRef.current = requestAnimationFrame(render);
    };

    rafIdRef.current = requestAnimationFrame(render);

    // 离开播放模式清理 raf 计时器
    return () => {
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [isPlaying, setCurrentTime, setIsPlaying, editorRef, rafIdRef]);
}
