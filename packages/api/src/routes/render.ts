import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { StorageAdapter } from "@vitecut/storage";
import { renderVideo } from "../lib/render.js";
import { requireAuth } from "../lib/requireAuth.js";
import { findById, update } from "../lib/taskRepository.js";
import { broadcastTaskUpdate } from "../lib/taskEvents.js";
import type { RenderJobRequest } from "../types.js";

export interface RenderRoutesOptions {
  storage: StorageAdapter;
}

// 渲染相关路由（用于发起渲染任务并上传 OSS）
export async function renderRoutes(
  fastify: FastifyInstance,
  opts: RenderRoutesOptions
): Promise<void> {
  const { storage } = opts;
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
  }>("/api/render-jobs", { preHandler: requireAuth }, async (request, reply) => {
    const { project, exportOptions, taskId } = request.body;
    const userId = (request as { user?: { userId: string } }).user?.userId;

    // 校验所需参数
    if (!project || !exportOptions || !taskId || typeof taskId !== "string") {
      return reply.status(400).send({
        error: "缺少 project、exportOptions 或 taskId",
      });
    }
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const failTask = async (message: string) => {
      await update(taskId, userId, { status: "failed", message });
      const task = await findById(taskId);
      if (task) broadcastTaskUpdate(userId, task);
    };

    const setTaskProgress = async (updates: {
      progress?: number;
      message?: string;
      status?: string;
    }) => {
      await update(taskId, userId, updates);
      const task = await findById(taskId);
      if (task) broadcastTaskUpdate(userId, task);
    };

    const updated = await update(taskId, userId, {
      status: "running",
      progress: 0,
      message: "正在准备导出…",
    });
    if (updated === null) {
      return reply.status(404).send({ error: "任务不存在" });
    }
    const task = await findById(taskId);
    if (task) broadcastTaskUpdate(userId, task);

    // 按用户要求立即返回 206，后续进度通过 SSE 推送。
    reply.status(206).send({ taskId });

    (async () => {
      try {
        await setTaskProgress({ progress: 10, message: "正在渲染视频…" });
        // 先本地渲染，再上传 OSS，避免 API 依赖本地 /output 静态文件。
        const outputPath = await renderVideo(project, exportOptions);
        let signedReadUrl = "";
        try {
          await setTaskProgress({ progress: 80, message: "正在上传导出文件…" });
          const ext = path.extname(outputPath).toLowerCase();
          const objectKey = storage.buildObjectKey(
            "system",
            `render${ext || ".mp4"}`
          );
          const contentType =
            ext === ".gif"
              ? "image/gif"
              : ext === ".mov"
                ? "video/quicktime"
                : "video/mp4";
          const uploaded = await storage.putBuffer({
            objectKey,
            buffer: fs.readFileSync(outputPath),
            contentType,
          });
          await setTaskProgress({ progress: 95, message: "正在生成访问链接…" });
          // 私有桶下导出结果需返回临时读签名，否则前端访问会 403。
          signedReadUrl = await storage.createSignedReadUrl({
            objectKey: storage.extractObjectKey(uploaded.url) || objectKey,
            expiresInSeconds: readUrlExpiresSeconds,
          });
        } finally {
          fs.rmSync(outputPath, { force: true });
        }

        await update(taskId, userId, {
          status: "success",
          progress: 100,
          message: null,
          results: JSON.stringify([{ url: signedReadUrl }]),
        });
        const doneTask = await findById(taskId);
        if (doneTask) broadcastTaskUpdate(userId, doneTask);
      } catch (err) {
        request.log.error(err, "导出后台任务异常");
        const msg = err instanceof Error ? err.message : "导出失败";
        await failTask(msg);
      }
    })().catch((err) => {
      request.log.error(err, "导出后台任务未捕获错误");
    });
  });
}
