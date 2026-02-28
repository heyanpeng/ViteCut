/**
 * AI 图片生成 API 客户端（火山方舟 Seedream）
 * 后端生成成功后自动入库，返回 imageUrl 和媒体记录
 */

import type { MediaRecord } from "@/api/mediaApi";

export interface GenerateAiImageParams {
  prompt: string;
  aspectRatio?: string;
  resolution?: string; // "2k" | "4k"
  model?: string;
}

export interface GenerateAiImageResponse {
  imageUrl: string;
  record: MediaRecord;
}

export async function generateAiImage(
  params: GenerateAiImageParams
): Promise<GenerateAiImageResponse> {
  const res = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio ?? "smart",
      resolution: params.resolution ?? "2k",
      model: params.model ?? "doubao-seedream-5.0-lite",
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `AI 图片生成失败: ${res.status}`
    );
  }

  return data as GenerateAiImageResponse;
}
