import { Tooltip } from "@/components/Tooltip";
import { Button, Dialog, Flex, Heading, Popover, Text } from "@radix-ui/themes";
import { Select } from "radix-ui";
import { Github, Keyboard, Redo, Undo, Upload, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useState } from "react";
import { useProjectStore } from "@/stores";
import { projectToRenderProject } from "@/export/projectToRenderProject";
import { getProjectDuration } from "@vitecut/project";
import "./Header.css";

/** 根据码率与时长估算导出文件大小（MB） */
function estimateExportSizeMb(
  durationSec: number,
  videoBitrateKbps: number,
  audioCodec: "aac" | "pcm",
  audioBitrateKbps: number,
  audioSampleRate: number
): number {
  // 估算视频部分的字节数
  const videoBytes = ((videoBitrateKbps * 1000) / 8) * durationSec;
  // 估算音频部分的字节数
  const audioBytes =
    audioCodec === "pcm"
      ? audioSampleRate * 2 * 2 * durationSec // PCM 为16位立体声
      : ((audioBitrateKbps * 1000) / 8) * durationSec;
  // 合计总字节数并转换为 MB
  return (videoBytes + audioBytes) / (1024 * 1024);
}

// 检测操作系统是否为 Mac，用于后续快捷键显示
const isMac =
  typeof navigator !== "undefined" && /mac/i.test(navigator.userAgent);
// MOD 用于显示快捷键中的修饰键名
const MOD = isMac ? "⌘" : "Ctrl";

// 定义快捷键分组
const SHORTCUT_GROUPS: {
  title: string;
  items: { label: string; keys: string[] }[];
}[] = [
  {
    title: "通用",
    items: [
      { label: "撤销", keys: [MOD, "Z"] },
      { label: "重做", keys: [MOD, "Shift", "Z"] },
      { label: "复制片段", keys: [MOD, "C"] },
      { label: "粘贴片段", keys: [MOD, "V"] },
      { label: "切断片段", keys: [MOD, "X"] },
      { label: "删除片段", keys: ["Delete"] },
    ],
  },
  {
    title: "播放",
    items: [{ label: "播放 / 暂停", keys: ["Space"] }],
  },
  {
    title: "时间轴缩放",
    items: [
      { label: "放大", keys: [MOD, "+"] },
      { label: "缩小", keys: [MOD, "−"] },
      { label: "适应视图", keys: [MOD, "0"] },
    ],
  },
];

// 导出格式类型
type ExportFormat = "480p" | "720p" | "1080p" | "2160p" | "gif";

// 分辨率选项
const RESOLUTION_OPTIONS: {
  value: ExportFormat;
  label: string;
  subtitle: string;
}[] = [
  { value: "480p", label: "480P", subtitle: "854 × 480" },
  { value: "720p", label: "720P", subtitle: "1280 × 720" },
  { value: "1080p", label: "1080P", subtitle: "1920 × 1080" },
  { value: "2160p", label: "4K", subtitle: "3840 × 2160" },
];

// 帧率选项
const FPS_OPTIONS: { value: number; label: string; subtitle?: string }[] = [
  { value: 24, label: "24 fps" },
  { value: 25, label: "25 fps" },
  { value: 29.97, label: "29.97 fps" },
  { value: 30, label: "30 fps" },
  { value: 50, label: "50 fps" },
  { value: 59.94, label: "59.94 fps" },
  { value: 60, label: "60 fps" },
  { value: 120, label: "120 fps" },
];

// 视频质量选项，部分用于快捷设置视频码率
const VIDEO_QUALITY_OPTIONS: {
  id: "lower" | "recommended" | "higher" | "custom";
  label: string;
  bitrateKbps?: number;
}[] = [
  {
    id: "lower",
    label: "更低",
    bitrateKbps: 2500,
  },
  {
    id: "recommended",
    label: "推荐",
    bitrateKbps: 5000,
  },
  {
    id: "higher",
    label: "更高",
    bitrateKbps: 8000,
  },
];

// 视频编码选项
const VIDEO_CODEC_OPTIONS: {
  value: "h264" | "hevc";
  label: string;
  subtitle: string;
}[] = [
  {
    value: "h264",
    label: "H.264",
    subtitle: "最常见的压缩方式，更加通用",
  },
  {
    value: "hevc",
    label: "HEVC",
    subtitle: "高效压缩方式，节省空间",
  },
];

// 容器格式选项，mp4 适用性广，mov 针对专业剪辑
const CONTAINER_OPTIONS: {
  value: "mp4" | "mov";
  label: string;
  subtitle: string;
}[] = [
  { value: "mp4", label: "MP4", subtitle: "通用格式，适合大多数平台" },
  { value: "mov", label: "MOV", subtitle: "适合专业剪辑软件" },
];

// 音频码率选项，包含 AAC 与无损 PCM
const AUDIO_BITRATE_OPTIONS: {
  value: number;
  codec: "aac" | "pcm";
  label: string;
}[] = [
  { value: 192, codec: "aac", label: "AAC 192 kbps" },
  { value: 256, codec: "aac", label: "AAC 256 kbps" },
  { value: 320, codec: "aac", label: "AAC 320 kbps" },
  { value: 0, codec: "pcm", label: "PCM 无损" },
];

// 音频采样率选项
const AUDIO_SAMPLE_RATE_OPTIONS: { value: 44100 | 48000; label: string }[] = [
  { value: 44100, label: "44100 Hz" },
  { value: 48000, label: "48000 Hz" },
];

// 通用下拉组件选项类型
type SimpleOption = { value: string; label: string; subtitle?: string };

/**
 * 通用下拉选择组件，导出设置各项选择控件公用
 */
function ExportSelect({
  value,
  onValueChange,
  options,
  ariaLabel,
  open,
  onOpenChange,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SimpleOption[];
  ariaLabel: string;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  return (
    <Select.Root
      value={value}
      onValueChange={onValueChange}
      open={open}
      onOpenChange={onOpenChange}
    >
      <Select.Trigger
        className="canvas-panel__size-selector export-select-trigger"
        aria-label={ariaLabel}
      >
        <div className="canvas-panel__size-dropdown">
          <Select.Value className="canvas-panel__size-label canvas-panel__size-value" />
        </div>
      </Select.Trigger>
      <Select.Portal>
        <Select.Content
          className="canvas-panel__dropdown-menu export-select-dropdown"
          position="popper"
          sideOffset={4}
        >
          <Select.Viewport className="canvas-panel__select-viewport">
            {options.map((opt) => (
              <Select.Item
                key={opt.value}
                value={opt.value}
                className="canvas-panel__dropdown-item"
              >
                {/* 触发器只会镜像 ItemText 的内容，这里仅放主 label */}
                <Select.ItemText>{opt.label}</Select.ItemText>
                {/* 副标题只在下拉菜单中显示，不会出现在触发器上 */}
                {opt.subtitle && (
                  <span className="export-select-item-subtitle">
                    {opt.subtitle}
                  </span>
                )}
              </Select.Item>
            ))}
          </Select.Viewport>
        </Select.Content>
      </Select.Portal>
    </Select.Root>
  );
}

/**
 * 返回默认的导出文件标题，格式如“2月27日00时27分”
 */
function getDefaultExportTitle(): string {
  const d = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const month = d.getMonth() + 1;
  const day = d.getDate();
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());
  // 形如 “2月27日00时27分”
  return `${month}月${day}日${hh}时${mm}分`;
}

/**
 * 根据导出格式和原始项目分辨率计算实际导出分辨率，保证宽高为偶数
 */
function getExportResolution(
  format: ExportFormat,
  projectWidth: number,
  projectHeight: number
): { width: number; height: number } {
  let targetHeight: number;
  switch (format) {
    case "480p":
      targetHeight = 480;
      break;
    case "720p":
      targetHeight = 720;
      break;
    case "1080p":
      targetHeight = 1080;
      break;
    case "2160p":
      targetHeight = 2160;
      break;
    case "gif":
      targetHeight = 480;
      break;
    default:
      targetHeight = projectHeight;
  }
  // 用项目宽高比决定导出宽度
  const aspect =
    projectWidth > 0 && projectHeight > 0
      ? projectWidth / projectHeight
      : 16 / 9;
  let targetWidth = Math.round(targetHeight * aspect);
  // 保证宽高为偶数，避免某些编码器报错
  if (targetWidth % 2 !== 0) targetWidth += 1;
  if (targetHeight % 2 !== 0) targetHeight += 1;
  return { width: targetWidth, height: targetHeight };
}

/**
 * 编辑器顶部 Header 组件，包含 logo、项目名、操作按钮、导出弹出层等
 */
export function Header() {
  // 获取项目相关状态与操作
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);

  // 本地状态：导出弹窗/导出参数
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("480p");
  const defaultExportTitle = getDefaultExportTitle();
  const [exportTitle, setExportTitle] = useState<string>(defaultExportTitle);
  const [exportFps, setExportFps] = useState<number>(30);
  const [exportContainer, setExportContainer] = useState<"mp4" | "mov">("mp4");
  const [openSelectId, setOpenSelectId] = useState<string | null>(null);
  const [videoBitrateKbps, setVideoBitrateKbps] = useState<number>(5000);
  const [videoQualityId, setVideoQualityId] = useState<
    "lower" | "recommended" | "higher" | "custom"
  >("recommended");
  const [videoCodec, setVideoCodec] = useState<"h264" | "hevc">("h264");
  const [audioBitrateKbps, setAudioBitrateKbps] = useState<number>(192);
  const [audioCodec, setAudioCodec] = useState<"aac" | "pcm">("aac");
  const [audioSampleRate, setAudioSampleRate] = useState<44100 | 48000>(44100);

  // 当前日期用于项目名称占位显示，格式类似 "11 Feb 2026"
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // 导出按钮点击处理函数
  const handleExport = async () => {
    if (!project || exporting) {
      return;
    }
    // 将工程转换为后端渲染所需的 RenderProject，并组合导出参数
    const renderProject = projectToRenderProject(project);
    const { width, height } = getExportResolution(
      exportFormat,
      project.width,
      project.height
    );
    const exportOptions = {
      width,
      height,
      fps: exportFps || project.fps,
      title: exportTitle.trim() || project.name || defaultExportTitle,
      format: exportFormat === "gif" ? "gif" : exportContainer,
      videoQuality: videoQualityId,
      videoBitrateKbps,
      videoCodec,
      audioCodec,
      audioBitrateKbps,
      audioSampleRate,
    };
    setExporting(true);
    setExportOpen(false);
    try {
      const res = await fetch("/api/render-jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          project: renderProject,
          exportOptions,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || `请求失败: ${res.status}`);
      }
      if (data.outputUrl) {
        window.open(data.outputUrl, "_blank");
      }
    } catch (err) {
      console.error("Export failed:", err);
      alert(err instanceof Error ? err.message : "导出失败");
    } finally {
      setExporting(false);
    }
  };

  // 是否允许导出
  const canExport = !!project && !loading && !exporting;

  return (
    <header className="app-editor-layout__header">
      {/* 左侧：Logo及项目名 */}
      <div className="app-editor-layout__header-left">
        <a href="/" className="app-editor-layout__logo">
          <img
            src={logoImg}
            alt="ViteCut"
            className="app-editor-layout__logo-img"
          />
        </a>
        <input
          type="text"
          className="app-editor-layout__project-name"
          defaultValue={todayLabel}
        />
      </div>
      {/* 右侧：撤销、重做、导出、快捷键、GitHub等按钮 */}
      <div className="app-editor-layout__header-right">
        {/* 撤销按钮 */}
        <Tooltip content="撤销">
          <button
            className="app-editor-layout__header-btn"
            disabled={!canUndo}
            onClick={undo}
            type="button"
          >
            <Undo size={16} />
          </button>
        </Tooltip>
        {/* 重做按钮 */}
        <Tooltip content="重做">
          <button
            className="app-editor-layout__header-btn"
            disabled={!canRedo}
            onClick={redo}
            type="button"
          >
            <Redo size={16} />
          </button>
        </Tooltip>
        {/* 导出弹窗触发 */}
        <Popover.Root open={exportOpen} onOpenChange={setExportOpen}>
          <Popover.Trigger>
            <Button
              variant="solid"
              size="2"
              disabled={!canExport}
              className="export-trigger-button"
            >
              <Upload size={16} />
              {exporting ? "导出中..." : "导出"}
            </Button>
          </Popover.Trigger>
          {/* 导出设置 Popover 内容 */}
          <Popover.Content width="480px" className="export-popover-content">
            <Flex direction="column" gap="4">
              {/* 弹窗标题与关闭按钮 */}
              <Flex
                justify="between"
                align="center"
                className="export-popover-header"
              >
                <Heading size="3" className="export-popover-title">
                  导出
                </Heading>
                <Popover.Close>
                  <button
                    type="button"
                    className="export-popover-close"
                    aria-label="关闭"
                  >
                    <X size={18} />
                  </button>
                </Popover.Close>
              </Flex>
              <div className="export-panel">
                <div className="export-panel-right">
                  {/* 导出参数设置表单区块 */}
                  <div className="export-panel-row">
                    <span className="export-panel-label">标题</span>
                    <div className="export-panel-control">
                      <input
                        type="text"
                        className="export-panel-title-input"
                        placeholder={defaultExportTitle}
                        value={exportTitle}
                        onChange={(e) => setExportTitle(e.target.value)}
                        maxLength={50}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">分辨率</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="分辨率"
                        value={exportFormat}
                        onValueChange={(v) =>
                          setExportFormat(v as ExportFormat)
                        }
                        open={openSelectId === "resolution"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "resolution" : null)
                        }
                        options={RESOLUTION_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                          subtitle: opt.subtitle,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">格式</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="导出格式"
                        value={exportContainer}
                        onValueChange={(v) =>
                          setExportContainer(v as "mp4" | "mov")
                        }
                        open={openSelectId === "container"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "container" : null)
                        }
                        options={CONTAINER_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">帧率</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="帧率"
                        value={String(exportFps)}
                        onValueChange={(v) => setExportFps(Number(v) || 30)}
                        open={openSelectId === "fps"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "fps" : null)
                        }
                        options={FPS_OPTIONS.map((opt) => ({
                          value: String(opt.value),
                          label: opt.label,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">视频码率</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="视频码率"
                        value={videoQualityId}
                        onValueChange={(id) => {
                          // 选择快捷项将码率同步修改
                          const castId = id as
                            | "lower"
                            | "recommended"
                            | "higher"
                            | "custom";
                          setVideoQualityId(castId);
                          const opt = VIDEO_QUALITY_OPTIONS.find(
                            (o) => o.id === castId
                          );
                          if (opt?.bitrateKbps) {
                            setVideoBitrateKbps(opt.bitrateKbps);
                          }
                        }}
                        open={openSelectId === "video-bitrate"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "video-bitrate" : null)
                        }
                        options={VIDEO_QUALITY_OPTIONS.map((opt) => ({
                          value: opt.id,
                          label: opt.label,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">视频编码</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="视频编码"
                        value={videoCodec}
                        onValueChange={(v) =>
                          setVideoCodec(v as "h264" | "hevc")
                        }
                        open={openSelectId === "video-codec"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "video-codec" : null)
                        }
                        options={VIDEO_CODEC_OPTIONS.map((opt) => ({
                          value: opt.value,
                          label: opt.label,
                          subtitle: opt.subtitle,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">音频质量</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="音频质量"
                        value={`${audioCodec}-${audioBitrateKbps}`}
                        onValueChange={(val) => {
                          // 组合 value，拆出 codec 和 bitrate
                          const [codec, bitrate] = val.split("-");
                          setAudioCodec(codec as "aac" | "pcm");
                          const num = Number(bitrate);
                          if (!Number.isNaN(num)) {
                            setAudioBitrateKbps(num);
                          }
                        }}
                        open={openSelectId === "audio-quality"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "audio-quality" : null)
                        }
                        options={AUDIO_BITRATE_OPTIONS.map((opt) => ({
                          value: `${opt.codec}-${opt.value}`,
                          label: opt.label,
                        }))}
                      />
                    </div>
                  </div>
                  <div className="export-panel-row">
                    <span className="export-panel-label">音频采样率</span>
                    <div className="export-panel-control">
                      <ExportSelect
                        ariaLabel="音频采样率"
                        value={String(audioSampleRate)}
                        onValueChange={(v) =>
                          setAudioSampleRate(Number(v) as 44100 | 48000)
                        }
                        open={openSelectId === "audio-sample-rate"}
                        onOpenChange={(isOpen) =>
                          setOpenSelectId(isOpen ? "audio-sample-rate" : null)
                        }
                        options={AUDIO_SAMPLE_RATE_OPTIONS.map((opt) => ({
                          value: String(opt.value),
                          label: opt.label,
                        }))}
                      />
                    </div>
                  </div>
                  {/* 项目信息与导出体积简单估算 */}
                  {project && (
                    <div className="export-panel-footer">
                      时长：{Math.round(getProjectDuration(project))}秒{" | "}
                      大小：
                      {estimateExportSizeMb(
                        getProjectDuration(project),
                        videoBitrateKbps,
                        audioCodec,
                        audioBitrateKbps,
                        audioSampleRate
                      ).toFixed(2)}
                      M（估计）
                    </div>
                  )}
                  {/* 导出继续按钮 */}
                  <Button
                    size="3"
                    variant="solid"
                    className="export-popover-continue"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    继续
                  </Button>
                </div>
              </div>
            </Flex>
          </Popover.Content>
        </Popover.Root>
        {/* 快捷键弹窗 */}
        <Dialog.Root>
          <Tooltip content="快捷键">
            <Dialog.Trigger>
              <button type="button" className="app-editor-layout__header-btn">
                <Keyboard size={16} />
              </button>
            </Dialog.Trigger>
          </Tooltip>
          <Dialog.Content maxWidth="480px" className="hotkeys-dialog">
            <Flex justify="between" align="center" mb="4">
              <Dialog.Title size="4" className="hotkeys-dialog__title">
                快捷键
              </Dialog.Title>
              <Dialog.Close>
                <button
                  type="button"
                  className="hotkeys-dialog__close"
                  aria-label="关闭"
                >
                  <X size={18} />
                </button>
              </Dialog.Close>
            </Flex>
            <div className="hotkeys-dialog__body">
              {/* 分组展示所有快捷键 */}
              {SHORTCUT_GROUPS.map((group) => (
                <div key={group.title} className="hotkeys-dialog__group">
                  <Text
                    size="1"
                    weight="medium"
                    color="gray"
                    className="hotkeys-dialog__group-title"
                  >
                    {group.title}
                  </Text>
                  {group.items.map((item) => (
                    <div key={item.label} className="hotkeys-dialog__row">
                      <Text size="2">{item.label}</Text>
                      <div className="hotkeys-dialog__keys">
                        {item.keys.map((k, i) => (
                          <span key={i}>
                            <kbd className="hotkeys-dialog__kbd">{k}</kbd>
                            {i < item.keys.length - 1 && (
                              <span className="hotkeys-dialog__plus">+</span>
                            )}
                          </span>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </Dialog.Content>
        </Dialog.Root>
        {/* 项目 GitHub 链接按钮 */}
        <Tooltip content="GitHub">
          <a
            href="https://github.com/heyanpeng/ViteCut"
            target="_blank"
            rel="noopener noreferrer"
            className="app-editor-layout__header-btn app-editor-layout__github-btn"
          >
            <Github size={16} />
          </a>
        </Tooltip>
      </div>
    </header>
  );
}
