import type { FastifyInstance } from "fastify";
import { renderVideo } from "../lib/render.js";
import type { RenderJobRequest } from "../types.js";

// 渲染相关路由（用于发起渲染任务）
export async function renderRoutes(fastify: FastifyInstance): Promise<void> {
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
      // 调用渲染逻辑，生成输出文件
      const outputUrl = await renderVideo(project, exportOptions);
      // 生成渲染任务 ID（本例简单用 uuid，可改为更复杂的任务跟踪机制）
      const id = crypto.randomUUID();
      // 返回渲染结果
      return {
        id,
        status: "completed" as const,
        outputUrl,
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
