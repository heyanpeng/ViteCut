import "./SidebarNav.css";
import {
  Plus,
  CloudUpload,
  LayoutGrid,
  Type,
  Music,
  Image,
  Shapes,
  SquarePlay,
  Disc,
  AudioLines,
} from "lucide-react";

interface NavItem {
  id: string;
  label: string;
  icon: React.ComponentType<{
    size?: number;
    className?: string;
    fill?: string;
  }>;
}

const navItems: NavItem[] = [
  { id: "media", label: "媒体", icon: CloudUpload },
  { id: "canvas", label: "画布", icon: LayoutGrid },
  { id: "text", label: "文本", icon: Type },
  { id: "audio", label: "音频", icon: Music },
  { id: "videos", label: "视频", icon: SquarePlay },
  { id: "images", label: "图像", icon: Image },
  { id: "elements", label: "元素", icon: Shapes },
  { id: "record", label: "录制", icon: Disc },
  { id: "tts", label: "TTS", icon: AudioLines },
];

interface SidebarNavProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function SidebarNav({
  activeTab = "media",
  onTabChange,
}: SidebarNavProps) {
  return (
    <nav className="sidebar-nav">
      <button className="nav-add-btn" title="Add">
        <Plus size={16} />
      </button>
      <div className="nav-items">
        {navItems.map((item) => {
          const IconComponent = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item ${activeTab === item.id ? "active" : ""}`}
              onClick={() => onTabChange?.(item.id)}
              title={item.label}
            >
              <span className="nav-icon">
                {item.id === "record" ? (
                  <IconComponent size={18} />
                ) : (
                  <IconComponent size={18} />
                )}
              </span>
              <span className="nav-label">{item.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
