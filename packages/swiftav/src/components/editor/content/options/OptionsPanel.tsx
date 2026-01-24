import { useState } from "react";
import { SidebarNav } from "../sidebar/SidebarNav";
import { MediaPanel } from "../panels/MediaPanel";
import { CanvasPanel } from "../panels/CanvasPanel";
import { TextPanel } from "../panels/TextPanel";
import { AudioPanel } from "../panels/AudioPanel";
import { VideoPanel } from "../panels/VideoPanel";
import { ImagePanel } from "../panels/ImagePanel";
import { ElementsPanel } from "../panels/ElementsPanel";
import { RecordPanel } from "../panels/RecordPanel";
import { TTSPanel } from "../panels/TTSPanel";
import "./OptionsPanel.css";

export function OptionsPanel() {
  const [activeTab, setActiveTab] = useState("media");
  const [renderedPanels, setRenderedPanels] = useState<Set<string>>(
    new Set(["media"])
  );

  const handleTabChange = (tabId: string) => {
    setActiveTab(tabId);
    setRenderedPanels((prev) => new Set(prev).add(tabId));
  };

  return (
    <div className="app-editor-layout__options-panel">
      <SidebarNav activeTab={activeTab} onTabChange={handleTabChange} />
      <div className="panels-container">
        {renderedPanels.has("media") && (
          <div
            style={{ display: activeTab === "media" ? "block" : "none" }}
          >
            <MediaPanel />
          </div>
        )}
        {renderedPanels.has("canvas") && (
          <div
            style={{ display: activeTab === "canvas" ? "block" : "none" }}
          >
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
          <div
            style={{ display: activeTab === "elements" ? "block" : "none" }}
          >
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
