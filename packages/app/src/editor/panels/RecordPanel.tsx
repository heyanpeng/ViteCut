import { Video, Monitor, MonitorSpeaker, AudioLines } from "lucide-react";
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
  return (
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
  );
}
