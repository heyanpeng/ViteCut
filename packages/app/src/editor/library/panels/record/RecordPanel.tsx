import { useState } from "react";
import { Video, Monitor, MonitorSpeaker, AudioLines } from "lucide-react";
import { AudioRecordOverlay } from "./AudioRecordOverlay";
import { CameraRecordOverlay } from "./CameraRecordOverlay";
import { ScreenRecordOverlay } from "./ScreenRecordOverlay";
import { useProjectStore } from "@/stores";
import { add as addToMediaStorage } from "@/utils/mediaStorage";
import { decodeAudioToPeaks, drawWaveformToDataUrl } from "@/utils/audioWaveform";
import type { RecordingResult } from "@vitecut/record";
import "./RecordPanel.css";

type RecordOption = {
  label: string;
  value: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
  bgColor: string;
  iconColor: string;
};

const recordOptions: RecordOption[] = [
  {
    label: "音频",
    value: "audio",
    icon: AudioLines,
    bgColor: "#2c5d4f",
    iconColor: "#76e6b3",
  },
  {
    label: "相机",
    value: "camera",
    icon: Video,
    bgColor: "#2c3d5e",
    iconColor: "#76ace6",
  },
  {
    label: "屏幕",
    value: "screen",
    icon: Monitor,
    bgColor: "#41335b",
    iconColor: "#b376e6",
  },
  {
    label: "屏幕和摄像头",
    value: "screen-camera",
    icon: MonitorSpeaker,
    bgColor: "#37373f",
    iconColor: "#e6e6e6",
  },
];

export function RecordPanel() {
  const [showAudioRecord, setShowAudioRecord] = useState(false);
  const [showCameraRecord, setShowCameraRecord] = useState(false);
  const [showScreenRecord, setShowScreenRecord] = useState(false);
  const loadAudioFile = useProjectStore((s) => s.loadAudioFile);
  const loadVideoFile = useProjectStore((s) => s.loadVideoFile);

  const createAudioFile = (result: RecordingResult, name: string) => {
    const ext = result.mimeType.split("/")[1]?.split(";")[0] || "webm";
    const safeName =
      name.replace(/[/\\:*?"<>|]/g, "_").trim() || `audio-record-${Date.now()}`;
    const fileName = `${safeName}.${ext}`;
    return new File([result.blob], fileName, { type: result.mimeType });
  };

  const saveAudioToMediaStorage = async (file: File) => {
    let coverUrl: string | undefined;
    try {
      const peaks = await decodeAudioToPeaks(file, 512);
      coverUrl = drawWaveformToDataUrl(peaks);
    } catch {
      coverUrl = undefined;
    }
    await addToMediaStorage({
      id: crypto.randomUUID(),
      name: file.name,
      type: "audio",
      addedAt: Date.now(),
      blob: file,
      coverUrl,
    });
  };

  const handleAudioAddToTimeline = async (result: RecordingResult, name: string) => {
    const file = createAudioFile(result, name);
    try {
      await loadAudioFile(file);
      await saveAudioToMediaStorage(file);
    } catch (err) {
      console.error("添加音频到时间轴失败:", err);
    }
  };

  const handleAudioAddToLibrary = async (result: RecordingResult, name: string) => {
    const file = createAudioFile(result, name);
    try {
      await saveAudioToMediaStorage(file);
    } catch (err) {
      console.error("添加音频到媒体库失败:", err);
    }
  };

  const createVideoFile = (result: RecordingResult, name: string, fallbackPrefix = "video-record") => {
    const ext = result.mimeType.split("/")[1]?.split(";")[0] || "webm";
    const safeName =
      name.replace(/[/\\:*?"<>|]/g, "_").trim() || `${fallbackPrefix}-${Date.now()}`;
    const fileName = `${safeName}.${ext}`;
    return new File([result.blob], fileName, { type: result.mimeType });
  };

  const saveVideoToMediaStorage = async (file: File) => {
    await addToMediaStorage({
      id: crypto.randomUUID(),
      name: file.name,
      type: "video",
      addedAt: Date.now(),
      blob: file,
    });
  };

  const handleCameraAddToTimeline = async (result: RecordingResult, name: string) => {
    const file = createVideoFile(result, name, "camera-record");
    try {
      await loadVideoFile(file);
      await saveVideoToMediaStorage(file);
    } catch (err) {
      console.error("添加摄像头录制到时间轴失败:", err);
    }
  };

  const handleCameraAddToLibrary = async (result: RecordingResult, name: string) => {
    const file = createVideoFile(result, name, "camera-record");
    try {
      await saveVideoToMediaStorage(file);
    } catch (err) {
      console.error("添加摄像头录制到媒体库失败:", err);
    }
  };

  const handleScreenAddToTimeline = async (result: RecordingResult, name: string) => {
    const file = createVideoFile(result, name, "screen-record");
    try {
      await loadVideoFile(file);
      await saveVideoToMediaStorage(file);
    } catch (err) {
      console.error("添加屏幕录制到时间轴失败:", err);
    }
  };

  const handleScreenAddToLibrary = async (result: RecordingResult, name: string) => {
    const file = createVideoFile(result, name, "screen-record");
    try {
      await saveVideoToMediaStorage(file);
    } catch (err) {
      console.error("添加屏幕录制到媒体库失败:", err);
    }
  };

  return (
    <>
      <div className="record-panel">
        <div className="record-panel__content">
          <div className="record-panel__grid">
            {recordOptions.map((option) => {
              const IconComponent = option.icon;
              return (
                <div
                  key={option.value}
                  className="record-panel__card"
                  style={{ backgroundColor: option.bgColor }}
                  onClick={() => {
                    if (option.value === "audio") {
                      setShowAudioRecord(true);
                    } else if (option.value === "camera") {
                      setShowCameraRecord(true);
                    } else if (option.value === "screen") {
                      setShowScreenRecord(true);
                    }
                  }}
                >
                  <div
                    className="record-panel__icon-wrapper"
                    style={{ color: option.iconColor }}
                  >
                    <IconComponent size={48} />
                  </div>
                  <span
                    className="record-panel__label"
                    style={{ color: option.iconColor }}
                  >
                    {option.label}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
      {showAudioRecord && (
        <AudioRecordOverlay
          onClose={() => setShowAudioRecord(false)}
          onAddToTimeline={handleAudioAddToTimeline}
          onAddToLibrary={handleAudioAddToLibrary}
        />
      )}
      {showCameraRecord && (
        <CameraRecordOverlay
          onClose={() => setShowCameraRecord(false)}
          onAddToTimeline={handleCameraAddToTimeline}
          onAddToLibrary={handleCameraAddToLibrary}
        />
      )}
      {showScreenRecord && (
        <ScreenRecordOverlay
          onClose={() => setShowScreenRecord(false)}
          onAddToTimeline={handleScreenAddToTimeline}
          onAddToLibrary={handleScreenAddToLibrary}
        />
      )}
    </>
  );
}
