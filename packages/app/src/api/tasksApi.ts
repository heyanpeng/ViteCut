/**
 * 任务 API 客户端（创建、列表等）
 * 与后端 /api/tasks 及 task 系统对接
 */

import { getAuthHeaders } from "@/contexts";

// 任务状态类型
export type TaskStatus = "pending" | "running" | "success" | "failed";

// 任务类型
export type TaskType =
  | "export" // 导出
  | "ai-image" // AI 图片生成
  | "ai-video" // AI 视频生成
  | "ai-audio" // AI 音频生成
  | "ai-tts" // AI 语音合成
  | "other"; // 其他

// 单条任务结果项
export interface TaskResultItem {
  url: string; // 结果文件 URL
  [key: string]: unknown; // 其它自定义字段
}

/** 服务端返回的任务对象（字段为驼峰） */
export interface ApiTask {
  id: string; // 任务唯一ID
  type: TaskType; // 任务类型
  status: TaskStatus; // 任务状态
  label: string; // 任务标题
  progress?: number; // 进度（0-100，可选）
  message?: string; // 状态消息（可选）
  results?: TaskResultItem[]; // 任务结果数组（可选）
  createdAt: number; // 创建时间（ms 时间戳）
  updatedAt: number; // 更新时间（ms 时间戳）
}

// 创建任务参数
export interface CreateTaskParams {
  type: TaskType; // 任务类型
  label: string; // 任务标题
  status?: TaskStatus; // 初始状态（默认 pending）
  progress?: number; // 进度（可选）
  message?: string; // 消息（可选）
  results?: TaskResultItem[]; // 结果数组（可选）
}

// 获取任务列表参数
export interface GetTasksParams {
  page?: number; // 页码（默认 1）
  limit?: number; // 单页数量（默认 50）
}

// 任务列表接口返回类型
export interface GetTasksResult {
  items: ApiTask[]; // 任务数组
  total: number; // 总任务数
}

/**
 * 拉取任务列表
 * @param params 分页参数（可选）
 * @returns {Promise<GetTasksResult>} 任务列表及总数
 * @throws 拉取失败时抛出异常
 */
export async function getTasks(
  params: GetTasksParams = {}
): Promise<GetTasksResult> {
  const page = params.page ?? 1;
  const limit = params.limit ?? 50;
  // 向后端请求任务列表
  const res = await fetch(`/api/tasks?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders(),
  });
  // 尝试解析返回数据
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 如果响应失败，抛出错误消息
    throw new Error(
      (data as { error?: string }).error || `获取任务列表失败: ${res.status}`
    );
  }
  // 返回结果数据
  return data as GetTasksResult;
}

/**
 * 创建新任务
 * @param params 任务创建参数
 * @returns {Promise<ApiTask>} 新建的任务对象
 * @throws 创建失败时抛出异常
 */
export async function createTask(params: CreateTaskParams): Promise<ApiTask> {
  // 发起 POST 请求创建任务
  const res = await fetch("/api/tasks", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify({
      type: params.type,
      label: params.label,
      status: params.status ?? "pending", // 默认 "pending"
      progress: params.progress,
      message: params.message,
      results: params.results,
    }),
  });

  // 尝试解析响应
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 请求失败时抛出详细错误信息
    throw new Error(
      (data as { error?: string }).error || `创建任务失败: ${res.status}`
    );
  }
  return data as ApiTask;
}

/**
 * 删除任务
 * @param id 任务 ID
 * @returns {Promise<boolean>} true 表示服务端已删除，false 表示服务端未找到（可能仅存在于本地）
 * @throws 删除失败时抛出异常
 */
export async function deleteTask(id: string): Promise<boolean> {
  const res = await fetch(`/api/tasks/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  // 404 特殊处理，直接返回 false
  if (res.status === 404) return false;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    // 删除失败则抛出错误
    throw new Error(
      (data as { error?: string }).error || `删除任务失败: ${res.status}`
    );
  }
  return true;
}
