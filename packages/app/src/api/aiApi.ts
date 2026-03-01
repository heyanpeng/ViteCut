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
  aspectRatio?: string; // 图片宽高比（可选，例如 "1:1", "16:9"）
  resolution?: string; // 分辨率（"2k" | "4k"，可选，默认 "2k"）
  model?: string; // 模型名（可选，默认 "doubao-seedream-5.0-lite"）
  referenceImages?: string[]; // 参考图（Data URL），可选，可辅助提示词生成图片
  /** 必填：关联的后端任务 id，进度与结果通过 SSE 推送，如前端生成 uuid */
  taskId: string;
}

/**
 * 图片生成接口返回的数据结构
 * 接口立即返回 202，生图在后台执行，进度与结果通过 SSE 推送
 */
export interface GenerateAiImageResponse {
  taskId: string; // 生成图片的任务 ID
}

/**
 * 可选的提示词增强类型
 * - proofread: 校对/纠错
 * - polish: 语句润色
 * - expand: 扩展补充
 * - abbreviate: 精简句子
 * - more-fun: 更加有趣
 * - more-pro: 更专业
 */
export type PromptEnhanceType =
  | "proofread"
  | "polish"
  | "expand"
  | "abbreviate"
  | "more-fun"
  | "more-pro";

/**
 * 提示词增强接口参数
 * prompt：原始提示词
 * type：增强方式
 * creationType：创作类型（"image" | "video"）
 */
export interface EnhanceAiPromptParams {
  prompt: string;
  type: PromptEnhanceType;
  creationType: "image" | "video";
}

/**
 * 提示词增强接口返回结构
 * text: 增强后的提示词/描述
 */
export interface EnhanceAiPromptResponse {
  text: string;
}

/**
 * 发起 AI 图片生成请求
 * @param params 生成图片所需参数（含 taskId），一般包含 prompt、aspectRatio、resolution、model、referenceImages
 * @returns 202 时返回 { taskId }，进度与结果由 SSE 推送
 * @throws 当请求失败或接口未返回 202 时抛出错误
 */
export async function generateAiImage(
  params: GenerateAiImageParams
): Promise<GenerateAiImageResponse> {
  // 发送 POST 请求到后端图片生成接口
  const res = await fetch("/api/ai/image", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      prompt: params.prompt,
      aspectRatio: params.aspectRatio ?? "smart", // 默认用 smart 宽高比
      resolution: params.resolution ?? "2k", // 默认 2k 分辨率
      model: params.model ?? "doubao-seedream-5.0-lite", // 默认模型
      referenceImages: params.referenceImages,
      taskId: params.taskId,
    }),
  });

  // 解析返回数据，如果不是 json（如网络中断），则返回空对象
  const data = await res.json().catch(() => ({}));
  // 如果 HTTP 状态非 2xx，则从返回内容提取错误信息作为异常抛出
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `AI 图片生成失败: ${res.status}`
    );
  }

  // 如果不是预期的 202 返回状态，则报错
  if (res.status !== 202) {
    throw new Error(`AI 图片生成失败: 期望 202，收到 ${res.status}`);
  }

  // 返回后端返回的 taskId
  return data as GenerateAiImageResponse;
}

/**
 * 调用提示词增强（优化/润色/扩写/缩写/更有趣/更专业）接口
 * @param params EnhanceAiPromptParams，包含 prompt, type, creationType
 * @returns 返回增强后的 text 字段
 * @throws 当接口失败或返回内容无效时抛出异常
 */
export async function enhanceAiPrompt(
  params: EnhanceAiPromptParams
): Promise<EnhanceAiPromptResponse> {
  // 发送 POST 请求到后端提示词增强接口
  const res = await fetch("/api/ai/prompt-enhance", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(params),
  });

  // 解析 JSON 返回内容，失败返回 {}
  const data = await res.json().catch(() => ({}));
  // 检查接口请求是否成功，否则抛出异常
  if (!res.ok) {
    throw new Error(
      (data as { error?: string }).error || `AI 提示词优化失败: ${res.status}`
    );
  }
  // 检查 text 字段的有效性，必须为非空字符串
  const text = (data as { text?: unknown }).text;
  if (typeof text !== "string" || text.trim().length === 0) {
    throw new Error("AI 提示词优化失败：未返回有效内容");
  }
  // 返回增强后的文本
  return { text };
}
