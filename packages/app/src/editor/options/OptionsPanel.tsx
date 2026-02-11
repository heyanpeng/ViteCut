import { useState, useEffect } from "react";
import { SidebarNav } from "@/editor/sidebar/SidebarNav";
import { MediaPanel } from "@/editor/panels/MediaPanel";
import { CanvasPanel } from "@/editor/panels/CanvasPanel";
import { TextPanel } from "@/editor/panels/TextPanel";
import { AudioPanel } from "@/editor/panels/AudioPanel";
import { VideoPanel } from "@/editor/panels/VideoPanel";
import { ImagePanel } from "@/editor/panels/ImagePanel";
import { ElementsPanel } from "@/editor/panels/ElementsPanel";
import { RecordPanel } from "@/editor/panels/RecordPanel";
import { TTSPanel } from "@/editor/panels/TTSPanel";
import "./OptionsPanel.css";

export function OptionsPanel() {
  const [activeTab, setActiveTab] = useState(() => {
    // 从 localStorage 读取保存的选中菜单，如果没有则使用默认值"media"
    const savedTab = localStorage.getItem("sidebar-active-tab");
    return savedTab || "media";
  });
  const [renderedPanels, setRenderedPanels] = useState<Set<string>>(() => {
    // 从 localStorage 读取已渲染的面板列表
    const savedPanels = localStorage.getItem("sidebar-rendered-panels");
    const savedTab = localStorage.getItem("sidebar-active-tab") || "media";

    if (savedPanels) {
      try {
        const panelsArray = JSON.parse(savedPanels) as string[];
        const panelsSet = new Set<string>(panelsArray);
        // 确保当前选中的标签也在已渲染列表中
        panelsSet.add(savedTab);
        return panelsSet;
      } catch {
        return new Set<string>(["media", savedTab]);
      }
    }
    return new Set<string>(["media", savedTab]);
  });

  // 保存选中的菜单到 localStorage
  useEffect(() => {
    localStorage.setItem("sidebar-active-tab", activeTab);
  }, [activeTab]);

  // 保存已渲染的面板列表到 localStorage
  useEffect(() => {
    localStorage.setItem(
      "sidebar-rendered-panels",
      JSON.stringify(Array.from(renderedPanels)),
    );
  }, [renderedPanels]);

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setRenderedPanels((prev) => new Set(prev).add(tabId));
  };

  return (
    <div className="app-editor-layout__options-panel">
      <SidebarNav activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="panels-container">
        {renderedPanels.has("media") && (
          <div style={{ display: activeTab === "media" ? "block" : "none" }}>
            <MediaPanel />
          </div>
        )}
        {renderedPanels.has("canvas") && (
          <div style={{ display: activeTab === "canvas" ? "block" : "none" }}>
            <CanvasPanel />
          </div>
        )}
        {renderedPanels.has("text") && (
          <div style={{ display: activeTab === "text" ? "block" : "none" }}>
            <TextPanel />
          </div>
        )}
        {renderedPanels.has("audio") && (
          <div style={{ display: activeTab === "audio" ? "block" : "none" }}>
            <AudioPanel />
          </div>
        )}
        {renderedPanels.has("videos") && (
          <div style={{ display: activeTab === "videos" ? "block" : "none" }}>
            <VideoPanel />
          </div>
        )}
        {renderedPanels.has("images") && (
          <div style={{ display: activeTab === "images" ? "block" : "none" }}>
            <ImagePanel />
          </div>
        )}
        {renderedPanels.has("elements") && (
          <div style={{ display: activeTab === "elements" ? "block" : "none" }}>
            <ElementsPanel />
          </div>
        )}
        {renderedPanels.has("record") && (
          <div style={{ display: activeTab === "record" ? "block" : "none" }}>
            <RecordPanel />
          </div>
        )}
        {renderedPanels.has("tts") && (
          <div style={{ display: activeTab === "tts" ? "block" : "none" }}>
            <TTSPanel />
          </div>
        )}
      </div>
    </div>
  );
}
