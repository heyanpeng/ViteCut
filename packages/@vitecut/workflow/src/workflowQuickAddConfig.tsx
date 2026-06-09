import type { ReactElement } from "react";
import {
  AudioGlyph,
  ImageGlyph,
  StoryboardGlyph,
  TextGlyph,
  UploadGlyph,
  VideoGlyph,
  WorldGlyph,
} from "./workflowIcons";
import type { WorkflowComposerNodeKind } from "./workflowTypes";

export type QuickAddAction =
  | { type: "node"; kind: WorkflowComposerNodeKind }
  | { type: "soon" };

export type QuickAddItem = {
  id: string;
  label: string;
  desc?: string;
  icon: ReactElement;
  action: QuickAddAction;
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
        action: { type: "node", kind: "prompt" },
      },
      {
        id: "image",
        label: "图片",
        desc: "宣传图、海报、封面",
        icon: <ImageGlyph />,
        action: { type: "node", kind: "image" },
      },
      {
        id: "video",
        label: "视频",
        desc: "宣传视频、动画、电影",
        icon: <VideoGlyph />,
        action: { type: "soon" },
      },
      {
        id: "world3d",
        label: "3D 世界",
        desc: "文生 3D / 图生 3D / 视频生 3D，渲染高斯泼溅 3D 世界",
        icon: <WorldGlyph />,
        action: { type: "soon" },
      },
      {
        id: "audio",
        label: "音频",
        desc: "上传音频文件",
        icon: <AudioGlyph />,
        action: { type: "soon" },
      },
    ],
  },
  {
    id: "function",
    title: "功能节点",
    items: [
      {
        id: "storyboard",
        label: "分镜格子",
        desc: "创建可拖拽排序的图片网格",
        icon: <StoryboardGlyph />,
        action: { type: "soon" },
      },
    ],
  },
  {
    id: "resource",
    title: "添加资源",
    divider: true,
    items: [
      {
        id: "upload",
        label: "上传",
        desc: "支持图片、视频、音频文件",
        icon: <UploadGlyph />,
        action: { type: "soon" },
      },
    ],
  },
];
