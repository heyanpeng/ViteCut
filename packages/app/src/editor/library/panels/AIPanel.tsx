import { Sparkles } from "lucide-react";
import "./AIPanel.css";

export function AIPanel() {
  return (
    <div className="ai-panel">
      <div className="ai-panel__placeholder">
        <Sparkles size={48} className="ai-panel__icon" />
        <p className="ai-panel__title">AI 面板</p>
        <p className="ai-panel__desc">AI 功能即将推出</p>
      </div>
    </div>
  );
}
