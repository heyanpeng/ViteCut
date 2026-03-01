/**
 * AI 图片生成 API 客户端（火山方舟 Seedream）
 * 需先创建任务并传入 taskId，接口立即返回 202，进度与结果通过 SSE 推送
 */

import { getAuthHeaders } from "@/contexts";

/**
 * 用于发起 AI 图片生成请求的参数
 */
export interface GenerateAiImageParams {
  prompt: string; // 提示词
  aspectRatio?: string; // 图片宽高比（可选）
  resolution?: string; // 分辨率（"2k" | "4k"，可选）
  model?: string; // 模型名（可选）
  /** 必填：关联的后端任务 id，进度与结果通过 SSE 推送 */
  taskId: string;
}

/**
 * 接口立即返回 202，生图在后台执行，进度与结果通过 SSE 推送
 */
export interface GenerateAiImageResponse {
  taskId: string;
}

/**
 * 发起 AI 图片生成请求
 * @param params 生成图片所需参数（含 taskId）
 * @returns 202 时返回 { taskId }，进度与结果由 SSE 推送
 * @throws 当请求失败时抛出错误
 */
export async function generateAiImage(
  params: GenerateAiImageParams
): Promise<GenerateAiImageResponse> {
  const res = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio ?? "smart",
      resolution: params.resolution ?? "2k",
      model: params.model ?? "doubao-seedream-5.0-lite",
      taskId: params.taskId,
    }),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `AI 图片生成失败: ${res.status}`
    );
  }

  if (res.status !== 202) {
    throw new Error(`AI 图片生成失败: 期望 202，收到 ${res.status}`);
  }

  return data as GenerateAiImageResponse;
}
