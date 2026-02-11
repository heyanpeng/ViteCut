import { useEffect, useMemo, useRef, useState } from "react";
import type { TimelineState } from "@swiftav/timeline";
import { ReactTimeline } from "@swiftav/timeline";
import type { Clip } from "@swiftav/project";
import { CanvasSink } from "mediabunny";
import { createInputFromUrl } from "@swiftav/media";
import { PlaybackControls } from "./PlaybackControls";
import { useProjectStore } from "@/stores";
import "./Timeline.css";

/**
 * 轨道之间的垂直间距（px）。
 *
 * 说明：
 * - `ReactTimeline` 的 `rowHeight` 只支持“整行高度”，不直接支持 row gap。
 * - 我们的做法是：把 rowHeight 设为「内容高度 + gap」，并在 CSS 中给每行加 padding-bottom，
 *   同时裁切背景/限制 action 高度，让 gap 区域保持空白。
 * - **注意**：这里的数值需要与 `Timeline.css` 里的 `--swiftav-timeline-track-gap` 保持一致。
 */
const TIMELINE_TRACK_GAP_PX = 8;
/**
 * 每条轨道可编辑内容区域的高度（px），不包含 gap。
 * 该值来自第三方时间轴默认行高的视觉基准。
 */
const TIMELINE_TRACK_CONTENT_HEIGHT_PX = 50;
/**
 * 传给第三方时间轴的 rowHeight（px）。
 * rowHeight = 内容高度 + gap
 */
const TIMELINE_ROW_HEIGHT_PX =
  TIMELINE_TRACK_CONTENT_HEIGHT_PX + TIMELINE_TRACK_GAP_PX;

/**
 * 刻度标签组件
 * 接收 scale（秒数），将其格式化为 "分:秒"（如 1:30）
 */
function ScaleLabel({ scale }: { scale: number }) {
  // 分钟
  const min = Math.floor(scale / 60);
  // 秒数
  const sec = Math.floor(scale % 60);
  // Padding 2 位
  const second = String(sec).padStart(2, "0");
  return <>{`${min}:${second}`}</>;
}

/**
 * Timeline 时间轴主组件
 * 显示项目的多轨时间轴、播放控制、缩放与同步功能
 */
export function Timeline() {
  // 取出 project、以及全局播放控制和时间设置函数
  const project = useProjectStore((s) => s.project);
  const setIsPlayingGlobal = useProjectStore((s) => s.setIsPlaying);
  const setCurrentTimeGlobal = useProjectStore((s) => s.setCurrentTime);
  const updateClipTiming = useProjectStore((s) => s.updateClipTiming);

  /**
   * 将 project.tracks/clips 转为 ReactTimeline 所需的数据结构
   * 轨道按 order 降序（order 越大越靠上）
   */
  const editorData = useMemo(() => {
    if (!project) {
      return [];
    }

    // 克隆并排序轨道
    const sortedTracks = [...project.tracks].sort((a, b) => b.order - a.order);
    return sortedTracks.map((track) => ({
      id: track.id,
      actions: track.clips.map((clip) => ({
        id: clip.id,
        start: clip.start,
        end: clip.end,
        effectId: clip.assetId, // 关联素材
      })),
    }));
  }, [project]);

  /**
   * 构建 effect map：将 assetId 映射为 {id, name}
   * 用于 timeline 显示素材关联
   */
  const effects = useMemo(() => {
    if (!project) {
      return {};
    }

    const map: Record<string, { id: string; name: string }> = {};
    for (const asset of project.assets) {
      map[asset.id] = {
        id: asset.id,
        name: asset.name || asset.id,
      };
    }
    return map;
  }, [project]);

  // timelineRef 用于操作 timeline 实例内部 API
  const timelineRef = useRef<TimelineState | null>(null);

  // 本地播放状态和当前时间（UI 层实时状态，防拖动时频繁写全局 store）
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  // 每一主刻度的宽度（像素），支持缩放
  const [scaleWidth, setScaleWidth] = useState(50);

  // timeline 外层 dom 容器引用，用于测量宽度
  const timelineContainerRef = useRef<HTMLDivElement | null>(null);

  /**
   * clipId -> Clip 的快速索引（避免在自定义渲染里反复遍历 tracks）
   */
  const clipById = useMemo(() => {
    if (!project) {
      return {} as Record<string, Clip>;
    }
    const map: Record<string, Clip> = {};
    for (const track of project.tracks) {
      for (const clip of track.clips) {
        map[clip.id] = clip;
      }
    }
    return map;
  }, [project]);

  /**
   * 视频缩略图状态：按 asset 维度缓存，供 Timeline 自定义渲染使用
   */
  type ThumbnailEntry = {
    status: "idle" | "loading" | "done" | "error";
    urls: string[];
    /**
     * 缩略图的宽高比（displayWidth / displayHeight），用于在时间轴中按轨道高度还原正确宽度。
     */
    aspectRatio?: number;
  };
  const [videoThumbnails, setVideoThumbnails] = useState<
    Record<string, ThumbnailEntry>
  >({});

  /**
   * 按 project.assets 增量生成视频缩略图
   * - 以 asset 为单位生成，所有引用该 asset 的 clip 共享一组缩略图
   * - 仅在还未生成或之前失败时触发生成
   */
  useEffect(() => {
    if (!project) {
      return;
    }

    const videoAssets = project.assets.filter(
      (a) => a.kind === "video" && a.source,
    );

    for (const asset of videoAssets) {
      const existing = videoThumbnails[asset.id];
      // 若该 asset 已经触发过缩略图生成（不管最终是 loading / done / error），
      // 就不再在此处重复发起，避免长视频反复重试导致日志一直打印。
      if (existing && existing.status !== "idle") {
        continue;
      }

      // 标记为 loading，避免重复触发
      setVideoThumbnails((prev) => ({
        ...prev,
        [asset.id]: {
          status: "loading",
          urls: existing?.urls ?? [],
          aspectRatio: existing?.aspectRatio,
        },
      }));

      void (async () => {
        try {
          const input = createInputFromUrl(asset.source!);
          const videoTrack = await input.getPrimaryVideoTrack();
          const track: any = videoTrack as any;
          if (!track || !(await track.canDecode())) {
            throw new Error("无法解码视频轨道");
          }

          const firstTimestamp = await track.getFirstTimestamp();
          const lastTimestamp = await track.computeDuration();
          const durationSeconds = lastTimestamp - firstTimestamp || 0;

          const aspectRatio =
            track.displayHeight > 0
              ? track.displayWidth / track.displayHeight
              : 16 / 9;

          // 缩略图数量按视频时长动态决定：
          // - 大约每 1 秒 1 张；
          // - 最少 16 张，最多 256 张，长视频时保持单格宽度不要过大。
          const baseThumbCount =
            durationSeconds > 0 ? Math.round(durationSeconds) : 16;
          const THUMB_COUNT = Math.min(256, Math.max(16, baseThumbCount));

          const timestamps = Array.from({ length: THUMB_COUNT }, (_, i) => {
            const ratio = (i + 0.5) / THUMB_COUNT;
            return firstTimestamp + ratio * (lastTimestamp - firstTimestamp);
          });

          // 按轨道内容高度生成缩略图：高度 = 轨道高度，宽度按视频原始宽高比计算，
          // 这样解码出的缩略图与时间轴上的实际渲染尺寸一致。
          const targetHeight = TIMELINE_TRACK_CONTENT_HEIGHT_PX;
          const height = targetHeight;
          const width = Math.max(1, Math.round(targetHeight * aspectRatio));

          const sink: any = new CanvasSink(track, {
            width,
            height,
            fit: "cover",
          });

          // 预先占位，长度等于 THUMB_COUNT，后续逐帧填充并即时写回 store，
          // 这样缩略图会“边生成边显示”，而不是等全部完成后才出现。
          const urls: string[] = Array(THUMB_COUNT).fill("");

          for (let index = 0; index < THUMB_COUNT; index++) {
            const ts = timestamps[index]!;

            let dataUrl = "";
            try {
              const wrapped = await sink.getCanvas(ts);
              if (wrapped) {
                const canvas = wrapped.canvas as HTMLCanvasElement;
                dataUrl = canvas.toDataURL("image/jpeg", 0.82);
              }
            } catch {
              // 单次解码失败忽略，由下面的回退逻辑处理
            }

            // 解码失败或返回空帧时，直接回退使用前一张缩略图；若前一张也没有，则保持空白
            if (!dataUrl && index > 0) {
              dataUrl = urls[index - 1] ?? "";
            }
            urls[index] = dataUrl;

            // 每完成一帧就写回一次，status 在最后一帧标记为 done。
            setVideoThumbnails((prev) => {
              const assetStillExists = project.assets.some(
                (a) => a.id === asset.id,
              );
              if (!assetStillExists) {
                return prev;
              }
              const prevEntry = prev[asset.id];
              const isLast = index === THUMB_COUNT - 1;
              return {
                ...prev,
                [asset.id]: {
                  status: isLast ? "done" : "loading",
                  urls: urls.slice(), // 拷贝一份，确保引用变化触发渲染
                  aspectRatio: prevEntry?.aspectRatio ?? aspectRatio,
                },
              };
            });
          }
        } catch (error) {
          setVideoThumbnails((prev) => {
            const prevEntry = prev[asset.id];
            return {
              ...prev,
              [asset.id]: {
                status: "error",
                urls: [],
                // 若此前已成功生成过，则沿用原来的宽高比；否则给一个合理的默认值
                aspectRatio: prevEntry?.aspectRatio ?? 16 / 9,
              },
            };
          });
        }
      })();
    }
  }, [project, videoThumbnails]);

  /**
   * 计算当前时间轴的最大时长
   * 取所有轨道所有片段的 end 最大值
   */
  const duration = useMemo(() => {
    return editorData.reduce((max, row) => {
      const rowMax = row.actions.reduce(
        (rowEnd: number, action: { end: number }) =>
          Math.max(rowEnd, action.end),
        0,
      );
      return Math.max(max, rowMax);
    }, 0);
  }, [editorData]);

  /**
   * 播放/暂停切换逻辑
   * 这里只切 UI 状态及全局 store，不实际操作媒体播放
   */
  const handleTogglePlay = () => {
    const api = timelineRef.current;
    if (!api) {
      return;
    }

    if (isPlaying) {
      // 暂停
      api.pause();
      setIsPlaying(false);
      setIsPlayingGlobal(false);
    } else {
      // 若已播到末尾，再次点击播放时从头开始
      const end = duration;
      const t = useProjectStore.getState().currentTime;
      if (end > 0 && t >= end) {
        api.setTime(0);
        setCurrentTime(0);
        setCurrentTimeGlobal(0);
      }

      // 播放（由 Preview rAF 驱动 currentTime，这里只设状态即可）
      setIsPlaying(true);
      setIsPlayingGlobal(true);
    }
  };

  /**
   * 一键回到时间轴开头，并暂停播放
   */
  const handleStepBackward = () => {
    const api = timelineRef.current;
    if (!api) return;
    api.pause();
    setIsPlaying(false);
    setIsPlayingGlobal(false);
    api.setTime(0);
    setCurrentTime(0);
    setCurrentTimeGlobal(0);
  };

  /**
   * 一键跳转到时间轴末尾，并暂停播放
   */
  const handleStepForward = () => {
    const api = timelineRef.current;
    if (!api) return;
    api.pause();
    setIsPlaying(false);
    setIsPlayingGlobal(false);
    const end = duration;
    api.setTime(end);
    setCurrentTime(end);
    setCurrentTimeGlobal(end);
  };

  /**
   * 播放同步逻辑
   * - 由全局 store 的 currentTime 驱动 timeline 播放头位置
   * - 用 requestAnimationFrame 循环，保持播放期间的平滑性
   * - 达到时长末尾时自动停止
   */
  useEffect(() => {
    if (!isPlaying) {
      return;
    }

    let frameId: number | null = null;

    const loop = () => {
      // 实时读取全局 currentTime
      const t = useProjectStore.getState().currentTime;
      setCurrentTime(t);
      timelineRef.current?.setTime?.(t);

      // 若已到末尾，停止播放
      if (t >= duration && duration > 0) {
        setIsPlaying(false);
        setIsPlayingGlobal(false);
        return;
      }

      frameId = requestAnimationFrame(loop);
    };

    frameId = requestAnimationFrame(loop);

    // 组件卸载时清理动画帧
    return () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [isPlaying, duration]);

  /**
   * 拖动播放头时，只实时刷新本地 currentTime 不写全局 store
   * - 提升拖动体验，防止 Preview 因 seek 频繁过多
   */
  const handleCursorDrag = (time: number) => {
    setCurrentTime(time);
  };

  /**
   * 拖动播放头松手时（pointerup），同步到全局 store
   * - 保持 UI 一致，并触发实际画面跳转
   */
  const handleCursorDragEnd = (time: number) => {
    setCurrentTime(time);
    setCurrentTimeGlobal(time);
  };

  /**
   * 时间轴缩小（scaleWidth 变小，刻度间距缩短）
   * 取最小 40px/格
   */
  const handleZoomOut = () => {
    setScaleWidth((prev) => Math.max(prev / 1.25, 40));
  };

  /**
   * 时间轴放大（scaleWidth 变大，刻度间距变宽）
   * 最大 400px/格
   */
  const handleZoomIn = () => {
    setScaleWidth((prev) => Math.min(prev * 1.25, 400));
  };

  /**
   * 适应视图区宽度自动缩放
   * 算法：以当前可见区刚好容纳全部时长为目标
   * 刻度间距限制 40-400px
   */
  const handleFitToView = () => {
    const container = timelineContainerRef.current;
    if (!container || duration <= 0) {
      return;
    }

    const width = container.clientWidth || window.innerWidth;
    const startLeft = 20;
    const tickCount = Math.max(Math.ceil(duration), 1); // 每秒一个刻度
    const target = (width - startLeft) / tickCount;

    setScaleWidth(Math.min(Math.max(target, 40), 400));

    const api = timelineRef.current;
    api?.setScrollLeft(0); // 滚动回到起点
  };

  return (
    <div className="app-editor-layout__timeline">
      {/* 播放控制区 */}
      <PlaybackControls
        isPlaying={isPlaying}
        currentTime={currentTime}
        duration={duration}
        onTogglePlay={handleTogglePlay}
        onStepBackward={handleStepBackward}
        onStepForward={handleStepForward}
        onZoomOut={handleZoomOut}
        onZoomIn={handleZoomIn}
        onFitToView={handleFitToView}
      />
      <div className="app-editor-layout__timeline-content">
        {editorData.length === 0 ? (
          // 如果当前没内容，提示添加媒体
          <div
            className="timeline-editor timeline-editor--empty"
            ref={timelineContainerRef}
          >
            <p className="app-editor-layout__timeline-message">
              将媒体添加到时间轴以开始创建视频
            </p>
          </div>
        ) : (
          // 主时间轴区域
          <div className="timeline-editor" ref={timelineContainerRef}>
            <ReactTimeline
              ref={timelineRef}
              // @ts-ignore: 第三方库未导出 TS 类型。后续有风险请逐步替换。
              editorData={editorData as any}
              // 轨道关联资源字典，key为素材assetId，value为{id, name}
              effects={effects as any}
              // 自定义 action 渲染：为视频 clip 显示缩略图
              // @ts-ignore: 第三方类型未暴露 getActionRender，运行时支持该属性
              getActionRender={(action: any) => {
                if (!project) return undefined;
                const clip: Clip | undefined = clipById[action.id];
                if (!clip) {
                  return undefined;
                }
                if (clip.kind !== "video") {
                  // 非视频片段走默认渲染
                  return undefined;
                }

                const assetThumb = videoThumbnails[clip.assetId];
                if (!assetThumb) {
                  // 该 asset 还未开始生成缩略图，使用默认渲染
                  return undefined;
                }

                const urls = assetThumb.urls;
                // 只要有至少一个切片，就按时间切片渲染；未生成的切片用“空图”占位
                if (!urls.length) {
                  return undefined;
                }

                const cells = urls;

                return (
                  <div className="swiftav-timeline-video-clip">
                    <div className="swiftav-timeline-video-clip__thumbs">
                      {cells.map((src, index) => (
                        <div
                          key={index}
                          className="swiftav-timeline-video-clip__thumb-cell"
                        >
                          {src ? (
                            <img src={src} alt="" />
                          ) : (
                            <div className="swiftav-timeline-video-clip__thumb-placeholder" />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              }}
              // 轨道行高（包含轨道之间的 gap）
              rowHeight={TIMELINE_ROW_HEIGHT_PX}
              // 拖拽移动 clip 结束后：将新 start/end 写回 project（否则预览/导出仍用旧时间）
              onActionMoveEnd={({ action, row, start, end }) => {
                updateClipTiming(action.id, start, end, row.id);
              }}
              // 改变 clip 长度结束后：同样写回 start/end（例如裁剪时长）
              onActionResizeEnd={({ action, row, start, end }) => {
                updateClipTiming(action.id, start, end, row.id);
              }}
              // 主刻度（每段的 "时间长度"，单位：秒），此处为1表示每格1秒
              scale={1}
              // 每主刻度的细分数，将1秒细分为10份用于显示子网格线
              scaleSplitCount={10}
              // 每一主刻度（1秒）横向显示宽度（像素），由 state 维护支持缩放
              scaleWidth={scaleWidth}
              // 时间轴内容距离左侧起始空白距离（像素）
              startLeft={20}
              // 最小主刻度数，保证界面紧凑，数值越大越容易滚动缩放
              minScaleCount={20}
              // 最大主刻度数，避免渲染超长时崩溃，绑定duration动态设置
              maxScaleCount={Math.max(200, Math.ceil(duration) + 20)}
              // 刻度标签自定义渲染函数，这里显示为“分:秒”格式
              getScaleRender={(scale) => <ScaleLabel scale={scale} />}
              // 拖动光标事件，处理当前时间更新
              onCursorDrag={handleCursorDrag}
              // 光标拖动结束事件（常用于同步全局状态）
              onCursorDragEnd={handleCursorDragEnd}
              // 区域点击回调，跳到指定时间并暂停播放，需多处更新本地及全局播放状态
              onClickTimeArea={(time: number) => {
                const api = timelineRef.current;
                // 暂停播放并跳转到点击时间点
                if (api) {
                  api.pause();
                  api.setTime(time);
                }
                // 更新本地播放状态和当前时间
                setIsPlaying(false);
                setCurrentTime(time);
                // 同步全局状态
                setCurrentTimeGlobal(time);
                setIsPlayingGlobal(false);
                // 返回 false 禁止事件冒泡
                return false;
              }}
            />
          </div>
        )}
      </div>
    </div>
  );
}
