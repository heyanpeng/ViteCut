import { Tooltip } from "@/components/Tooltip";
import { Button, Flex, Heading, Popover, Text } from "@radix-ui/themes";
import { Crown, Github, Redo, Undo, Upload, X } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { useState } from "react";
import { useProjectStore } from "@/stores";
import "./Header.css";

type ExportFormat = "480p" | "720p" | "1080p" | "2160p" | "gif";

const RESOLUTION_OPTIONS: {
  value: ExportFormat;
  label: string;
  subtitle: string;
  premium?: boolean;
}[] = [
  { value: "480p", label: "480p", subtitle: "标准质量" },
  { value: "720p", label: "720p", subtitle: "标准质量, HD" },
  { value: "1080p", label: "1080p", subtitle: "高质量, FHD", premium: true },
  { value: "2160p", label: "2160p", subtitle: "高质量, 4K", premium: true },
];

export function Header() {
  const project = useProjectStore((s) => s.project);
  const loading = useProjectStore((s) => s.loading);
  const exportToMp4 = useProjectStore((s) => s.exportToMp4);
  const canUndo = useProjectStore((s) => s.historyPast.length > 0);
  const canRedo = useProjectStore((s) => s.historyFuture.length > 0);
  const undo = useProjectStore((s) => s.undo);
  const redo = useProjectStore((s) => s.redo);
  const [exporting, setExporting] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [exportFormat, setExportFormat] = useState<ExportFormat>("480p");

  // 当前日期显示，格式类似 "11 Feb 2026"
  const todayLabel = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  const handleExport = async () => {
    if (!project || exporting) {
      return;
    }
    if (1) {
      // 输出 project 数据到控制台，用于调试
      console.log("Current project data:", project);
      return;
    }
    setExporting(true);
    setExportOpen(false);
    try {
      const blob = await exportToMp4();
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const ext = exportFormat === "gif" ? "gif" : "mp4";
      a.download = `${project.name || "vitecut-export"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const canExport = !!project && !loading && !exporting;

  return (
    <header className="app-editor-layout__header">
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
      <div className="app-editor-layout__header-right">
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
        <Popover.Root open={exportOpen} onOpenChange={setExportOpen}>
          <Popover.Trigger>
            <Button variant="solid" size="2" disabled={!canExport}>
              <Upload size={16} />
              {exporting ? "导出中..." : "导出"}
            </Button>
          </Popover.Trigger>
          <Popover.Content width="400px" className="export-popover-content">
            <Flex direction="column" gap="4">
              <Flex
                justify="between"
                align="center"
                className="export-popover-header"
              >
                <Heading size="3" className="export-popover-title">
                  导出设置
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
              <Flex gap="2" wrap="wrap" className="export-options-grid">
                {RESOLUTION_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`export-option-card ${exportFormat === opt.value ? "export-option-card--selected" : ""}`}
                    onClick={() => setExportFormat(opt.value)}
                  >
                    {opt.premium && (
                      <span className="export-option-card-crown">
                        <Crown size={14} />
                      </span>
                    )}
                    <Text size="2" weight="medium">
                      {opt.label}
                    </Text>
                    <Text size="1" color="gray">
                      {opt.subtitle}
                    </Text>
                  </button>
                ))}
              </Flex>
              <button
                type="button"
                className={`export-option-card export-option-card--gif ${exportFormat === "gif" ? "export-option-card--selected" : ""}`}
                onClick={() => setExportFormat("gif")}
              >
                <Text size="2" weight="medium">
                  GIF
                </Text>
                <Text size="1" color="gray">
                  项目时长最多 30 秒
                </Text>
              </button>
              <Button
                size="3"
                variant="solid"
                className="export-popover-continue"
                onClick={handleExport}
                disabled={exporting}
              >
                继续
              </Button>
            </Flex>
          </Popover.Content>
        </Popover.Root>
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
