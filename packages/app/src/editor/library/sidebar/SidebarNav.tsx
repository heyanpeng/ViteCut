import { Button } from "@radix-ui/themes";
import { Tooltip } from "@/components/Tooltip";
import { useAddMediaContext } from "@/contexts/AddMediaContext";
import {
  Plus,
  CloudUpload,
  Sparkles,
  LayoutGrid,
  Type,
  Music,
  Image,
  Shapes,
  SquarePlay,
  Disc,
  // AudioLines,
} from "lucide-react";
import "./SidebarNav.css";

// 侧边栏每个导航项的数据结构
type NavItem = {
  id: string; // 唯一标识
  label: string; // 显示标签
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    fill?: string;
  }>; // 图标组件
};

// 侧边栏导航列表
const navItems: NavItem[] = [
  { id: "media", label: "媒体", icon: CloudUpload },
  { id: "ai", label: "AI", icon: Sparkles },
  { id: "canvas", label: "画布", icon: LayoutGrid },
  { id: "videos", label: "视频", icon: SquarePlay },
  { id: "audio", label: "音频", icon: Music },
  { id: "images", label: "图像", icon: Image },
  { id: "text", label: "文本", icon: Type },
  { id: "elements", label: "元素", icon: Shapes },
  { id: "record", label: "录制", icon: Disc },
  // TODO: TTS 功能暂未实现
  // { id: "tts", label: "TTS", icon: AudioLines },
];

// 侧边栏导航组件 Props
type SidebarNavProps = {
  activeTab?: string; // 当前激活的 tab id
  onTabChange?: (tabId: string) => void; // 改变 tab 时的回调
};

/**
 * 侧边栏导航组件
 * @param activeTab 当前激活的 tab（可选，默认 media）
 * @param onTabChange 切换 tab 时触发的回调（可选）
 */
export const SidebarNav = ({
  activeTab = "media",
  onTabChange,
}: SidebarNavProps) => {
  const { trigger } = useAddMediaContext();

  return (
    <nav className="sidebar-nav">
      {/* 顶部添加媒体按钮，与媒体面板添加功能一致 */}
      <Tooltip content="添加媒体到媒体库和工程" side="right" sideOffset={-10}>
        <Button
          variant="solid"
          radius="full"
          size="1"
          className="nav-add-btn"
          aria-label="添加媒体到媒体库和工程"
          onClick={trigger}
        >
          <Plus size={16} />
        </Button>
      </Tooltip>
      {/* 所有导航项 */}
      <div className="nav-items">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => {
                // 仅当 onTabChange 存在时调用
                if (onTabChange) {
                  onTabChange(item.id);
                }
              }}
              title={item.label}
            >
              {/* 图标 */}
              <span className="nav-icon">
                {/* 可在此特殊处理某些图标样式 */}
                <IconComponent size={18} />
              </span>
              {/* 标签文本 */}
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
};
