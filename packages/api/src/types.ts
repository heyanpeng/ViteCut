/**
 * RenderProject 类型说明：
 * 与 @vitecut/project 内的 RenderProject 完全对齐，确保 API、前端、后端无缝对接。
 * 如调整字段结构，需同步更新相关 projectToRenderProject 转换逻辑。
 *
 * 各细分类型（RenderAsset、RenderClip、RenderTrack 等）详见下方注释。
 */
export interface RenderAsset {
  /** 唯一 ID */
  id: string;
  /** 资源源地址 (本地路径或 URL) */
  source: string;
  /** 资源类型，支持 video/audio/image/text */
  kind: "video" | "audio" | "image" | "text";
  /** （可选）媒体时长（秒） */
  duration?: number;
  /** （可选）视频相关属性（分辨率、旋转、帧率等） */
  videoMeta?: {
    width: number;
    height: number;
    rotation?: number;
    fps?: number;
    codec?: string;
  };
  /** （可选）音频相关属性（采样率、声道等） */
  audioMeta?: {
    sampleRate: number;
    channels: number;
    codec?: string;
  };
  /** （可选）图片相关属性（扩展自定义） */
  imageMeta?: unknown;
  /** （可选）文本相关属性（扩展自定义） */
  textMeta?: unknown;
}

/**
 * 渲染片段，每个剪辑都是某一资产在时间轴上布置的片段
 */
export interface RenderClip {
  /** 片段唯一 ID */
  id: string;
  /** 所属轨道 ID */
  trackId: string;
  /** 关联的资产 ID */
  assetId: string;
  /** 类型（如视频/音频/图片/文本/自定义） */
  kind: string;
  /** 片段在时间轴上的起始时间（秒） */
  start: number;
  /** 片段在时间轴上的结束时间（秒） */
  end: number;
  /** （可选）资产媒体的入点（裁剪起始），单位：秒 */
  inPoint?: number;
  /** （可选）资产媒体的出点（裁剪结束），单位：秒 */
  outPoint?: number;
  /** （可选）变换属性（如位置、缩放、旋转等，结构前端提供） */
  transform?: unknown;
  /** （可选）自定义参数（如滤镜、特效等） */
  params?: unknown;
}

/**
 * 渲染轨道（视频/音频/图片/文本等可分多轨），包含一组片段
 */
export interface RenderTrack {
  /** 轨道唯一 ID */
  id: string;
  /** 轨道类型（如 video/audio 等） */
  kind: string;
  /** （可选）轨道名称 */
  name?: string;
  /** 排序序号（升序在 timeline 前面） */
  order: number;
  /** （可选）是否静音音轨 */
  muted?: boolean;
  /** （可选）是否隐藏轨道 */
  hidden?: boolean;
  /** 此轨道下的所有片段 */
  clips: RenderClip[];
}

/**
 * 整个渲染项目结构，包含所有资源、轨道和片段信息
 */
export interface RenderProject {
  /** 项目唯一 ID */
  id: string;
  /** 项目名称 */
  name: string;
  /** 项目结构版本号，仅支持 1 */
  version: 1;
  /** 时间线帧率（帧/秒） */
  fps: number;
  /** 视频输出宽度 */
  width: number;
  /** 视频输出高度 */
  height: number;
  /** （可选）画布背景色（CSS 颜色字符串，如 #000000） */
  backgroundColor?: string;
  /** 项目时长（秒） */
  duration: number;
  /** （可选）导出设置（留作扩展） */
  exportSettings?: unknown;
  /** （可选）创建时间（ISO 字符串） */
  createdAt?: string;
  /** （可选）最近更新时间（ISO 字符串） */
  updatedAt?: string;
  /** 使用到的全部资产资源 */
  assets: RenderAsset[];
  /** 所有轨道 */
  tracks: RenderTrack[];
}

/**
 * 前端传递的导出参数，与 Header 中 exportOptions 结构一致
 */
export interface ExportOptions {
  /** 输出宽度（像素） */
  width: number;
  /** 输出高度（像素） */
  height: number;
  /** 帧率 */
  fps: number;
  /** 导出文件标题 */
  title: string;
  /** 导出文件格式（mp4/mov/gif） */
  format: "mp4" | "mov" | "gif";
  /** （可选）视频质量，如 'high', 'medium', 'low' */
  videoQuality?: string;
  /** 视频比特率（kbps） */
  videoBitrateKbps: number;
  /** 视频编码格式 */
  videoCodec: "h264" | "hevc";
  /** 音频编码格式 */
  audioCodec: "aac" | "pcm";
  /** 音频比特率（kbps） */
  audioBitrateKbps: number;
  /** 音频采样率（Hz） */
  audioSampleRate: number;
}

/**
 * 发起渲染任务的请求体类型
 */
export interface RenderJobRequest {
  /** 要渲染的项目结构 */
  project: RenderProject;
  /** 导出参数 */
  exportOptions: ExportOptions;
}

/**
 * 渲染任务接口的响应类型
 */
export interface RenderJobResponse {
  /** 渲染任务 ID */
  id: string;
  /** 渲染状态（仅支持已完成，后续可扩展） */
  status: "completed";
  /** 渲染输出文件的下载 URL */
  outputUrl: string;
}
