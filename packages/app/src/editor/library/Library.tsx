import { useState, useEffect } from "react";
import { SidebarNav } from "@/editor/library/sidebar/SidebarNav";
import { MediaPanel } from "@/editor/library/panels/media/MediaPanel";
import { AIPanel } from "@/editor/library/panels/ai/AIPanel";
import { CanvasPanel } from "@/editor/library/panels/canvas/CanvasPanel";
import { TextPanel } from "@/editor/library/panels/text/TextPanel";
import { AudioPanel } from "@/editor/library/panels/audio/AudioPanel";
import { VideoPanel } from "@/editor/library/panels/video/VideoPanel";
import { ImagePanel } from "@/editor/library/panels/image/ImagePanel";
import { ElementsPanel } from "@/editor/library/panels/elements/ElementsPanel";
import { RecordPanel } from "@/editor/library/panels/record/RecordPanel";
import { TTSPanel } from "@/editor/library/panels/tts/TTSPanel";
import "./Library.css";

export function Library() {
  const [activeTab, setActiveTab] = useState(() => {
    const savedTab = localStorage.getItem("sidebar-active-tab");
    return savedTab || "media";
  });
  const [renderedPanels, setRenderedPanels] = useState<Set<string>>(() => {
    const savedPanels = localStorage.getItem("sidebar-rendered-panels");
    const savedTab = localStorage.getItem("sidebar-active-tab") || "media";

    if (savedPanels) {
      try {
        const panelsArray = JSON.parse(savedPanels) as string[];
        const panelsSet = new Set<string>(panelsArray);
        panelsSet.add(savedTab);
        return panelsSet;
      } catch {
        return new Set<string>(["media", savedTab]);
      }
    }
    return new Set<string>(["media", savedTab]);
  });

  useEffect(() => {
    localStorage.setItem("sidebar-active-tab", activeTab);
  }, [activeTab]);

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
    <div className="app-editor-layout__library">
      <SidebarNav activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="library-panels">
        {renderedPanels.has("media") && (
          <div style={{ display: activeTab === "media" ? "block" : "none" }}>
            <MediaPanel />
          </div>
        )}
        {renderedPanels.has("ai") && (
          <div style={{ display: activeTab === "ai" ? "block" : "none" }}>
            <AIPanel />
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
            <AudioPanel isActive={activeTab === "audio"} />
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
