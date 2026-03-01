/**
 * AI 图片生成 API 客户端（火山方舟 Seedream）
 * 后端生成成功后自动入库，返回 imageUrl 和媒体记录（需登录）
 */

import { getAuthHeaders } from "@/contexts";
import type { MediaRecord } from "@/api/mediaApi";

/**
 * 用于发起 AI 图片生成请求的参数
 */
export interface GenerateAiImageParams {
  prompt: string; // 提示词
  aspectRatio?: string; // 图片宽高比（可选）
  resolution?: string; // 分辨率（"2k" | "4k"，可选）
  model?: string; // 模型名（可选）
  /** 关联的后端任务 id，传入则后端会更新任务状态并可在响应中返回 task */
  taskId?: string;
}

/**
 * AI 图片生成接口的响应类型
 */
export interface GenerateAiImageResponse {
  imageUrl: string; // 图片下载链接
  record: MediaRecord; // 媒体信息记录
  /** 传入 taskId 时，成功或失败后返回更新后的任务 */
  task?: {
    id: string;
    status: string;
    message?: string;
    results?: Array<{ url: string }>;
  };
}

/**
 * 发起 AI 图片生成请求
 * @param params 生成图片所需参数
 * @returns 生成结果，包括图片 url、媒体记录，及（如果有）任务状态
 * @throws 当请求失败时抛出错误
 */
export async function generateAiImage(
  params: GenerateAiImageParams
): Promise<GenerateAiImageResponse> {
  // 组织请求参数，自动设置默认 aspectRatio、resolution、model
  const res = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio ?? "smart",
      resolution: params.resolution ?? "2k",
      model: params.model ?? "doubao-seedream-5.0-lite",
      // 仅在 taskId 存在时添加该字段
      ...(params.taskId != null && { taskId: params.taskId }),
    }),
  });

  // 解析响应，若解析失败则返回空对象
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 如果响应失败，抛出错误信息（优先返回后端 error 字段）
    throw new Error(
      (data as { error?: string }).error || `AI 图片生成失败: ${res.status}`
    );
  }

  // 返回成功响应
  return data as GenerateAiImageResponse;
}
