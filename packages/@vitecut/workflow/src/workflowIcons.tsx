import {
  ArrowLeftRight,
  Clapperboard,
  Contact,
  LogOut,
  MousePointer2,
  Play,
  Plus,
  Replace,
  Save,
  Scissors,
  Trash2,
  Wand2,
  Workflow,
} from "lucide-react";
import type { WorkflowSidebarMenu } from "./workflowTypes";

const DEFAULT_STROKE = 1.8;

export function SidebarGlyph({ kind }: { kind: WorkflowSidebarMenu }) {
  if (kind === "nodes") {
    return <Plus size={18} strokeWidth={2} aria-hidden />;
  }
  return <Workflow size={18} strokeWidth={1.6} aria-hidden />;
}

export function DeleteGlyph({ size = 16 }: { size?: number }) {
  return <Trash2 size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function ScissorsGlyph({ size = 14 }: { size?: number }) {
  return <Scissors size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function SwapGlyph({ size = 20 }: { size?: number }) {
  return <ArrowLeftRight size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function SaveGlyph({ size = 14 }: { size?: number }) {
  return <Save size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function PlayGlyph({ size = 14 }: { size?: number }) {
  return <Play size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function ExitGlyph({ size = 14 }: { size?: number }) {
  return <LogOut size={size} strokeWidth={DEFAULT_STROKE} aria-hidden />;
}

export function CursorGlyph({ size = 14 }: { size?: number }) {
  return <MousePointer2 size={size} strokeWidth={2} aria-hidden />;
}

export function TextVideoGlyph({ size = 18 }: { size?: number }) {
  return <Wand2 size={size} strokeWidth={1.6} aria-hidden />;
}

export function BgSwapGlyph({ size = 18 }: { size?: number }) {
  return <Replace size={size} strokeWidth={1.6} aria-hidden />;
}

export function FrameVideoGlyph({ size = 18 }: { size?: number }) {
  return <Clapperboard size={size} strokeWidth={1.6} aria-hidden />;
}

export function MyFlowGlyph({ size = 18 }: { size?: number }) {
  return <Contact size={size} strokeWidth={1.6} aria-hidden />;
}
