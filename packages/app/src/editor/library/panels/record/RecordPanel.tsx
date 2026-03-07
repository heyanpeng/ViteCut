import { useState } from "react";
import { Video, Monitor, MonitorSpeaker, AudioLines } from "lucide-react";
import { AudioRecordOverlay } from "./AudioRecordOverlay";
import { CameraRecordOverlay } from "./CameraRecordOverlay";
import { ScreenRecordOverlay } from "./ScreenRecordOverlay";
import { ScreenCameraRecordOverlay } from "./ScreenCameraRecordOverlay";
import { useProjectStore } from "@/stores";
import { useAddMediaContext } from "@/contexts";
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
  const [showScreenCameraRecord, setShowScreenCameraRecord] = useState(false);
  const addMediaPlaceholder = useProjectStore((s) => s.addMediaPlaceholder);
  const resolveMediaPlaceholder = useProjectStore(
    (s) => s.resolveMediaPlaceholder
  );
  const { uploadFile } = useAddMediaContext();

  const createAudioFile = (result: RecordingResult, name: string) => {
    const ext = result.mimeType.split("/")[1]?.split(";")[0] || "webm";
    const safeName =
      name.replace(/[/\\:*?"<>|]/g, "_").trim() || `audio-record-${Date.now()}`;
    const fileName = `${safeName}.${ext}`;
    return new File([result.blob], fileName, { type: result.mimeType });
  };

  const uploadRecordedFileToLibrary = async (
    file: File,
    errorPrefix: string
  ) => {
    try {
      await uploadFile(file);
    } catch (err) {
      console.error(`${errorPrefix}:`, err);
    }
  };

  const uploadRecordedFileToTimeline = async (
    file: File,
    kind: "video" | "audio",
    errorPrefix: string
  ) => {
    const ids = addMediaPlaceholder({
      name: file.name,
      kind,
    });
    try {
      const record = await uploadFile(file);
      await resolveMediaPlaceholder(ids, record.url, {
        mediaMeta: record.meta,
      });
    } catch (err) {
      await resolveMediaPlaceholder(ids, null);
      console.error(`${errorPrefix}:`, err);
    }
  };

  const handleAudioAddToTimeline = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createAudioFile(result, name);
    await uploadRecordedFileToTimeline(file, "audio", "添加音频到时间轴失败");
  };

  const handleAudioAddToLibrary = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createAudioFile(result, name);
    await uploadRecordedFileToLibrary(file, "添加音频到媒体库失败");
  };

  const createVideoFile = (
    result: RecordingResult,
    name: string,
    fallbackPrefix = "video-record"
  ) => {
    const ext = result.mimeType.split("/")[1]?.split(";")[0] || "webm";
    const safeName =
      name.replace(/[/\\:*?"<>|]/g, "_").trim() ||
      `${fallbackPrefix}-${Date.now()}`;
    const fileName = `${safeName}.${ext}`;
    return new File([result.blob], fileName, { type: result.mimeType });
  };

  const handleCameraAddToTimeline = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "camera-record");
    await uploadRecordedFileToTimeline(
      file,
      "video",
      "添加摄像头录制到时间轴失败"
    );
  };

  const handleCameraAddToLibrary = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "camera-record");
    await uploadRecordedFileToLibrary(file, "添加摄像头录制到媒体库失败");
  };

  const handleScreenAddToTimeline = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "screen-record");
    await uploadRecordedFileToTimeline(file, "video", "添加屏幕录制到时间轴失败");
  };

  const handleScreenAddToLibrary = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "screen-record");
    await uploadRecordedFileToLibrary(file, "添加屏幕录制到媒体库失败");
  };

  const handleScreenCameraAddToTimeline = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "screen-camera-record");
    await uploadRecordedFileToTimeline(
      file,
      "video",
      "添加屏幕和摄像头录制到时间轴失败"
    );
  };

  const handleScreenCameraAddToLibrary = async (
    result: RecordingResult,
    name: string
  ) => {
    const file = createVideoFile(result, name, "screen-camera-record");
    await uploadRecordedFileToLibrary(file, "添加屏幕和摄像头录制到媒体库失败");
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
                    } else if (option.value === "screen-camera") {
                      setShowScreenCameraRecord(true);
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
      {showScreenCameraRecord && (
        <ScreenCameraRecordOverlay
          onClose={() => setShowScreenCameraRecord(false)}
          onAddToTimeline={handleScreenCameraAddToTimeline}
          onAddToLibrary={handleScreenCameraAddToLibrary}
        />
      )}
    </>
  );
}
