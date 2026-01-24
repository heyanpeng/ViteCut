import './SidebarNav.css';

interface NavItem {
  id: string;
  label: string;
  icon: string;
}

const navItems: NavItem[] = [
  { id: 'media', label: '媒体', icon: 'media' },
  { id: 'canvas', label: '画布', icon: 'canvas' },
  { id: 'text', label: '文本', icon: 'T' },
  { id: 'audio', label: '音频', icon: '♪' },
  { id: 'videos', label: '视频', icon: '▶' },
  { id: 'images', label: '图像', icon: '🖼' },
  { id: 'elements', label: '元素', icon: '◇' },
  { id: 'record', label: '录制', icon: '●' },
  { id: 'tts', label: 'TTS', icon: 'tts' },
];

interface SidebarNavProps {
  activeTab?: string;
  onTabChange?: (tabId: string) => void;
}

export function SidebarNav({ activeTab = 'media', onTabChange }: SidebarNavProps) {
  return (
    <nav className="sidebar-nav">
      <button className="nav-add-btn" title="Add">
        <svg className="app-svg-symbol app-svg-symbol--block" width="20px" height="20px" xmlns="http://www.w3.org/2000/svg" xmlnsXlink="http://www.w3.org/1999/xlink">
          <use xlinkHref="#svg-main-navigation-tab-icon-upload"></use>
        </svg>
      </button>
      <div className="nav-items">
        {navItems.map((item) => (
          <button
            key={item.id}
            className={`nav-item ${activeTab === item.id ? 'active' : ''}`}
            onClick={() => onTabChange?.(item.id)}
            title={item.label}
          >
            <span className={`nav-icon icon-${item.icon}`}>
              {item.icon === 'media' && (
                <>
                  <span className="cloud-icon">☁</span>
                  <span className="arrow-up">↑</span>
                </>
              )}
              {item.icon === 'canvas' && (
                <span className="canvas-icon">▦</span>
              )}
              {item.icon === 'tts' && (
                <span className="tts-icon">〰</span>
              )}
              {!['media', 'canvas', 'tts'].includes(item.icon) && item.icon}
            </span>
            <span className="nav-label">{item.label}</span>
          </button>
        ))}
      </div>
    </nav>
  );
}
