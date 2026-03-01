import fs from "node:fs";
import path from "node:path";
import type { FastifyInstance } from "fastify";
import type { StorageAdapter } from "@vitecut/storage";
import { renderVideo } from "../lib/render.js";
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
    Body: RenderJobRequest;
  }>("/api/render-jobs", async (request, reply) => {
    const { project, exportOptions } = request.body;

    // 校验所需参数
    if (!project || !exportOptions) {
      return reply.status(400).send({
        error: "缺少 project 或 exportOptions",
      });
    }

    try {
      // 先本地渲染，再上传 OSS，避免 API 依赖本地 /output 静态文件。
      const outputPath = await renderVideo(project, exportOptions);
      let signedReadUrl = "";
      try {
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
        // 私有桶下导出结果需返回临时读签名，否则前端访问会 403。
        signedReadUrl = await storage.createSignedReadUrl({
          objectKey: storage.extractObjectKey(uploaded.url) || objectKey,
          expiresInSeconds: readUrlExpiresSeconds,
        });
      } finally {
        fs.rmSync(outputPath, { force: true });
      }

      // 生成渲染任务 ID（本例简单用 uuid，可改为更复杂的任务跟踪机制）
      const id = crypto.randomUUID();
      // 返回渲染结果
      return {
        id,
        status: "completed" as const,
        outputUrl: signedReadUrl,
      };
    } catch (err) {
      // 记录错误日志，并返回 500
      request.log.error(err);
      return reply.status(500).send({
        error: err instanceof Error ? err.message : "渲染失败",
      });
    }
  });
}
