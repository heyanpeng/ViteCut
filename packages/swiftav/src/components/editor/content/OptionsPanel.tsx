import { useState } from "react";
import { SidebarNav } from "./SidebarNav";
import { AssetPanel } from "./AssetPanel";
import "./OptionsPanel.css";

export function OptionsPanel() {
  const [activeTab, setActiveTab] = useState('media');

  return (
    <div className="app-editor-layout__options-panel">
      <SidebarNav activeTab={activeTab} onTabChange={setActiveTab} />
      <AssetPanel />
    </div>
  );
}
