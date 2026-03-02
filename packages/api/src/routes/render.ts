import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { StorageAdapter } from "@vitecut/storage";
import { renderVideo } from "../lib/render.js";
import { requireAuth } from "../lib/requireAuth.js";
import { findById, update } from "../lib/taskRepository.js";
import { broadcastTaskUpdate } from "../lib/taskEvents.js";
import type { RenderJobRequest } from "../types.js";

/**
 * 渲染路由参数配置接口
 */
export interface RenderRoutesOptions {
  storage: StorageAdapter;
}

/**
 * 渲染相关路由（用于发起渲染任务并上传 OSS）
 */
export async function renderRoutes(
  fastify: FastifyInstance,
  opts: RenderRoutesOptions
): Promise<void> {
  const { storage } = opts;
  // 从环境变量中读取访问链接过期时间(秒)，限制 60~3600，默认 900
  const rawReadUrlExpiresSeconds = Number.parseInt(
    process.env.OSS_READ_URL_EXPIRES_SECONDS || "",
    10
  );
  const readUrlExpiresSeconds = Number.isFinite(rawReadUrlExpiresSeconds)
    ? Math.max(60, Math.min(3600, rawReadUrlExpiresSeconds))
    : 900;

  // 注册 POST /api/render-jobs 路由，用于提交渲染任务
  fastify.post<{
    Body: RenderJobRequest & { taskId: string };
  }>(
    "/api/render-jobs",
    { preHandler: requireAuth },
    async (request, reply) => {
      // 解构请求参数
      const { project, exportOptions, taskId } = request.body;
      // 获取用户ID
      const userId = (request as { user?: { userId: string } }).user?.userId;

      // 校验必需参数 project/exportOptions/taskId 是否存在
      if (!project || !exportOptions || !taskId || typeof taskId !== "string") {
        return reply.status(400).send({
          error: "缺少 project、exportOptions 或 taskId",
        });
      }
      // 校验用户是否已登录
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }

      // 任务失败时，设置任务状态并广播
      const failTask = async (message: string) => {
        await update(taskId, userId, { status: "failed", message });
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      // 更新任务进度并广播
      const setTaskProgress = async (updates: {
        progress?: number;
        message?: string;
        status?: string;
      }) => {
        await update(taskId, userId, updates);
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      // 首先将任务状态设置为 running，进度为 0
      const updated = await update(taskId, userId, {
        status: "running",
        progress: 0,
        message: "正在准备导出…",
      });
      if (updated === null) {
        // 未找到任务
        return reply.status(404).send({ error: "任务不存在" });
      }
      // 初始主动推送一次任务状态
      const task = await findById(taskId);
      if (task) broadcastTaskUpdate(userId, task);

      // 按用户要求立即返回 206，后续进度通过 SSE 推送。
      reply.status(206).send({ taskId });

      // 启动异步后台渲染任务流程
      (async () => {
        try {
          // 10%：渲染阶段
          await setTaskProgress({ progress: 10, message: "正在渲染视频…" });
          // 先本地渲染，再上传 OSS，避免 API 依赖本地 /output 静态文件。
          const outputPath = await renderVideo(project, exportOptions);

          let signedReadUrl = "";
          try {
            // 80%：上传中
            await setTaskProgress({
              progress: 80,
              message: "正在上传导出文件…",
            });

            // 输出文件名后缀
            const ext = path.extname(outputPath).toLowerCase();
            // 构建 OSS 文件 objectKey
            const objectKey = storage.buildObjectKey(
              "system",
              `render${ext || ".mp4"}`
            );
            // 根据不同格式设置 contentType
            const contentType =
              ext === ".gif"
                ? "image/gif"
                : ext === ".mov"
                  ? "video/quicktime"
                  : "video/mp4";
            // 上传到 OSS，返回上传结果
            const uploaded = await storage.putBuffer({
              objectKey,
              buffer: fs.readFileSync(outputPath),
              contentType,
            });
            // 95%：生成访问链接
            await setTaskProgress({
              progress: 95,
              message: "正在生成访问链接…",
            });
            // OSS 私有桶：需要生成临时签名访问链接给前端，否则 403
            signedReadUrl = await storage.createSignedReadUrl({
              objectKey: storage.extractObjectKey(uploaded.url) || objectKey,
              expiresInSeconds: readUrlExpiresSeconds,
            });
          } finally {
            // 无论是否成功，始终尝试清理临时输出文件
            fs.rmSync(outputPath, { force: true });
          }

          // 100%：成功，更新任务为 success，结果中包含访问链接
          await update(taskId, userId, {
            status: "success",
            progress: 100,
            message: null,
            results: JSON.stringify([{ url: signedReadUrl }]),
          });
          const doneTask = await findById(taskId);
          if (doneTask) broadcastTaskUpdate(userId, doneTask);
        } catch (err) {
          // 出现异常，记录日志，将任务标记为失败
          request.log.error(err, "导出后台任务异常");
          const msg = err instanceof Error ? err.message : "导出失败";
          await failTask(msg);
        }
      })().catch((err) => {
        // 异步 IIFE 未捕获的顶层异常，确保日志记录
        request.log.error(err, "导出后台任务未捕获错误");
      });
    }
  );
}
