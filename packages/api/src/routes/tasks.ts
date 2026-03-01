// 任务相关路由模块
import type { FastifyInstance } from "fastify";
import type { RowDataPacket } from "mysql2";
// 导入任务仓库和类型定义
import {
  listByUserId,
  findById,
  create,
  update,
  deleteTask,
  clearByUserId,
  type TaskType,
  type TaskStatus,
  type TaskResult,
} from "../lib/taskRepository.js";
// 导入认证中间件
import { requireAuth } from "../lib/requireAuth.js";
// 导入任务事件（用于SSE）
import { subscribe, broadcastTaskUpdate } from "../lib/taskEvents.js";
import { db } from "../lib/db.js";

// 支持的任务类型列表
const TASK_TYPES: TaskType[] = [
  "export",
  "ai-image",
  "ai-video",
  "ai-audio",
  "ai-tts",
  "other",
];

// 判断类型参数是否合法
function isValidTaskType(type: unknown): type is TaskType {
  return typeof type === "string" && TASK_TYPES.includes(type as TaskType);
}

// 判断任务状态参数是否合法
function isValidTaskStatus(status: unknown): status is TaskStatus {
  return (
    typeof status === "string" &&
    (status === "pending" ||
      status === "running" ||
      status === "success" ||
      status === "failed")
  );
}

// 任务相关路由注册函数
export async function taskRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * 获取当前用户任务列表
   * GET /api/tasks
   * 支持分页（page, limit）
   */
  fastify.get<{
    Querystring: { page?: string; limit?: string };
  }>("/api/tasks", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as { user?: { userId: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    // 解析分页参数，设置默认/最大值
    const page = Math.max(1, parseInt(request.query.page || "1", 10));
    const limit = Math.min(
      100,
      Math.max(1, parseInt(request.query.limit || "20", 10))
    );
    const offset = (page - 1) * limit;

    // 查询任务列表
    const result = await listByUserId(userId, { limit, offset });
    return result;
  });

  /**
   * 创建新任务
   * POST /api/tasks
   * 请求体需要 type 和 label
   * 可选状态、进度、消息、结果参数
   */
  fastify.post<{
    Body: {
      type?: unknown;
      label?: string;
      status?: unknown;
      progress?: number;
      message?: string;
      results?: TaskResult[];
    };
  }>("/api/tasks", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as { user?: { userId: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const { type, label, status, progress, message, results } =
      request.body || {};

    // 校验任务类型
    if (!isValidTaskType(type)) {
      return reply.status(400).send({ error: "无效的任务类型" });
    }
    // 校验 label 字符串
    if (
      !label ||
      typeof label !== "string" ||
      label.trim().length === 0 ||
      label.length > 512
    ) {
      return reply
        .status(400)
        .send({ error: "label 必填且长度不超过 512 个字符" });
    }

    // 校验（或默认）任务状态
    const taskStatus: TaskStatus = isValidTaskStatus(status)
      ? status
      : "pending";
    const now = Date.now();
    // 生成任务ID
    const taskId = `task_${now}_${Math.random().toString(36).slice(2, 9)}`;

    // 持久化任务
    const task = await create({
      id: taskId,
      user_id: userId,
      type,
      status: taskStatus,
      label: label.trim(),
      progress:
        progress != null && progress >= 0 && progress <= 100 ? progress : null,
      message: message || null,
      results: results ? JSON.stringify(results) : null,
      created_at: now,
      updated_at: now,
    });

    return task;
  });

  /**
   * 更新任务
   * PATCH /api/tasks/:id
   * 支持部分字段的更新，如状态、进度、label等
   */
  fastify.patch<{
    Params: { id: string };
    Body: {
      status?: unknown;
      progress?: number;
      message?: string;
      results?: TaskResult[];
      label?: string;
    };
  }>("/api/tasks/:id", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as { user?: { userId: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const { id } = request.params;
    // 查询任务是否存在
    const existing = await findById(id);
    if (!existing) {
      return reply.status(404).send({ error: "任务不存在" });
    }

    // 查询所属用户，防止越权操作
    const [rows] = await db.query<RowDataPacket[]>(
      "SELECT user_id FROM tasks WHERE id = ?",
      [id]
    );
    const taskUserId = (rows?.[0] as { user_id?: string })?.user_id;
    if (!taskUserId) {
      return reply.status(404).send({ error: "任务不存在" });
    }
    if (taskUserId !== userId) {
      return reply.status(403).send({ error: "无权限操作该任务" });
    }

    // 拆解请求体
    const { status, progress, message, results, label } = request.body || {};
    // 构建更新字段对象
    const updates: Partial<{
      status: string;
      progress: number | null;
      message: string | null;
      results: string | null;
      label: string;
    }> = {};

    // 校验/设置各字段
    if (status !== undefined) {
      if (!isValidTaskStatus(status)) {
        return reply.status(400).send({ error: "无效的任务状态" });
      }
      updates.status = status;
    }
    if (progress !== undefined) {
      if (typeof progress !== "number" || progress < 0 || progress > 100) {
        return reply
          .status(400)
          .send({ error: "progress 必须是 0-100 的数字" });
      }
      updates.progress = progress;
    }
    if (message !== undefined) {
      updates.message = typeof message === "string" ? message : null;
    }
    if (results !== undefined) {
      updates.results = Array.isArray(results) ? JSON.stringify(results) : null;
    }
    if (label !== undefined) {
      if (typeof label !== "string" || label.length > 512) {
        return reply.status(400).send({ error: "label 长度不超过 512 个字符" });
      }
      updates.label = label.trim();
    }

    // 如果没有实际更新内容，直接返回旧的
    if (Object.keys(updates).length === 0) {
      return existing;
    }

    // 执行更新操作
    const updatedAt = await update(id, userId, updates);
    if (!updatedAt) {
      return reply.status(404).send({ error: "任务不存在" });
    }

    // 查找并推送更新后的内容
    const updated = await findById(id);
    if (updated) {
      broadcastTaskUpdate(userId, updated);
    }

    return updated || existing;
  });

  /**
   * 删除单条任务
   * DELETE /api/tasks/:id
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/tasks/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as { user?: { userId: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }

      const { id } = request.params;
      // 检查任务归属，防止越权删除
      const [rows] = await db.query<RowDataPacket[]>(
        "SELECT user_id FROM tasks WHERE id = ?",
        [id]
      );
      const taskUserId = (rows?.[0] as { user_id?: string })?.user_id;
      if (!taskUserId) {
        return reply.status(404).send({ error: "任务不存在" });
      }
      if (taskUserId !== userId) {
        return reply.status(403).send({ error: "无权限操作该任务" });
      }

      // 删除操作
      const ok = await deleteTask(id, userId);
      if (!ok) {
        return reply.status(404).send({ error: "任务不存在" });
      }
      return { ok: true };
    }
  );

  /**
   * 清空用户任务
   * DELETE /api/tasks
   * 支持参数 completedOnly=true 只清除已完成任务
   */
  fastify.delete<{
    Querystring: { completedOnly?: string };
  }>("/api/tasks", { preHandler: requireAuth }, async (request, reply) => {
    const userId = (request as { user?: { userId: string } }).user?.userId;
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    // 只清理已完成任务还是全部
    const completedOnly = request.query.completedOnly === "true";
    // 调用清理函数，返回删除数量
    const deleted = await clearByUserId(userId, { completedOnly });
    return { deleted };
  });

  /**
   * SSE 任务更新流
   * GET /api/tasks/stream
   * 客户端连接后持续收到自己的任务状态更新
   */
  fastify.get(
    "/api/tasks/stream",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = (request as { user?: { userId: string } }).user?.userId;
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }

      // 设置 SSE 响应头并立即刷新，避免代理/网关缓冲导致客户端收不到实时推送
      reply.raw.setHeader("Content-Type", "text/event-stream");
      reply.raw.setHeader("Cache-Control", "no-cache");
      reply.raw.setHeader("Connection", "keep-alive");
      reply.raw.setHeader("X-Accel-Buffering", "no");
      reply.raw.flushHeaders();

      // 向客户端推送 SSE 消息的函数
      const send = (data: string) => {
        try {
          reply.raw.write(data);
        } catch (err) {
          // 连接可能已断开，写出错
          console.error("[tasks/stream] Failed to write:", err);
        }
      };

      // 首次连接先通报连接成功
      send("event: connected\ndata: {}\n\n");

      // 订阅自己帐号的任务更新推送
      const unsubscribe = subscribe(userId, send);

      // 连接关闭时取消推送
      request.raw.on("close", () => {
        unsubscribe();
      });

      // 保持请求挂起直到客户端关闭
      await new Promise<void>((resolve) => {
        request.raw.on("close", () => {
          resolve();
        });
      });
    }
  );
}
