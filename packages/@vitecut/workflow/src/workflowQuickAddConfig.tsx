import type { ReactElement } from "react";
import {
  AppGlyph,
  AudioGlyph,
  ImageGlyph,
  ImportGlyph,
  StoryboardGlyph,
  TextGlyph,
  UploadGlyph,
  VideoGlyph,
  WorldGlyph,
} from "./workflowIcons";

export type QuickAddItem = {
  id: string;
  label: string;
  desc?: string;
  icon: ReactElement;
};

export type QuickAddGroup = {
  id: string;
  title?: string;
  divider?: boolean;
  items: QuickAddItem[];
};

export const QUICK_ADD_GROUPS: QuickAddGroup[] = [
  {
    id: "node",
    title: "添加节点",
    items: [
      {
        id: "text",
        label: "文本",
        desc: "脚本、广告词、品牌文案",
        icon: <TextGlyph />,
      },
      { id: "image", label: "图片", icon: <ImageGlyph /> },
      { id: "video", label: "视频", icon: <VideoGlyph /> },
      { id: "world3d", label: "3D 世界", icon: <WorldGlyph /> },
      { id: "audio", label: "音频", icon: <AudioGlyph /> },
    ],
  },
  {
    id: "function",
    title: "功能节点",
    items: [
      { id: "storyboard", label: "分镜格子", icon: <StoryboardGlyph /> },
      { id: "ai-app", label: "AI 应用", icon: <AppGlyph /> },
    ],
  },
  {
    id: "resource",
    title: "添加资源",
    divider: true,
    items: [
      { id: "upload", label: "上传", icon: <UploadGlyph /> },
      { id: "import-work", label: "从作品导入", icon: <ImportGlyph /> },
    ],
  },
];
