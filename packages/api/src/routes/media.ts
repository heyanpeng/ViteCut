import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  addRecord,
  listRecords,
  updateRecord,
  deleteRecord,
  type MediaRecord,
} from "../lib/mediaLibrary.js";
import { getBaseUrl } from "../utils/baseUrl.js";

// 媒体路由选项接口，包含上传目录和端口号
export interface MediaRoutesOptions {
  uploadsDir: string;
  port: number;
}

// 注册媒体相关路由 (上传、查询、更新、删除)
export async function mediaRoutes(
  fastify: FastifyInstance,
  opts: MediaRoutesOptions
): Promise<void> {
  const { uploadsDir, port } = opts;

  /**
   * 上传媒体文件
   * POST /api/media
   * 支持上传视频、图片、音频文件
   * 返回媒体记录对象
   */
  fastify.post("/api/media", async (request, reply) => {
    // 获取上传的单个文件
    const data = await request.file();
    if (!data) {
      // 未上传文件时返回 400
      return reply.status(400).send({ error: "缺少文件" });
    }

    // 获取扩展名（无则用 .bin）
    const ext = path.extname(data.filename) || ".bin";
    // 随机生成文件名，避免冲突
    const filename = `${randomUUID()}${ext}`;
    // 拼接存储路径
    const filepath = path.join(uploadsDir, filename);

    // 将上传内容写入磁盘
    const buffer = await data.toBuffer();
    fs.writeFileSync(filepath, buffer);

    // 构造外部可访问的下载 URL
    const baseUrl = getBaseUrl(request.headers, port);
    const url = `${baseUrl}/uploads/${filename}`;

    // 基于 MIME 类型判定资源类型
    const rawType = data.mimetype ?? "";
    const type = rawType.startsWith("video/")
      ? "video"
      : rawType.startsWith("image/")
        ? "image"
        : rawType.startsWith("audio/")
          ? "audio"
          : ("video" as MediaRecord["type"]); // 默认用 video 类型

    // 添加媒体记录到数据库
    const record = addRecord({
      name: data.filename,
      type,
      url,
      filename,
    });

    // 返回新建的媒体记录
    return record;
  });

  /**
   * 查询媒体资源列表
   * GET /api/media
   * 支持类型筛选、搜索、分页、时间范围筛选
   * 返回 { items, total }
   */
  fastify.get<{
    Querystring: {
      type?: string;
      search?: string;
      page?: string;
      limit?: string;
      addedAtSince?: string;
      addedAtUntil?: string;
    };
  }>("/api/media", async (request) => {
    const { type, search, page, limit, addedAtSince, addedAtUntil } =
      request.query;
    // 校验 type 参数合法性
    const validType =
      type === "video" || type === "image" || type === "audio"
        ? type
        : undefined;

    // 返回筛选后结果列表
    return listRecords({
      type: validType,
      search: search || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      addedAtSince: addedAtSince ? parseInt(addedAtSince, 10) : undefined,
      addedAtUntil: addedAtUntil ? parseInt(addedAtUntil, 10) : undefined,
    });
  });

  /**
   * 更新媒体记录
   * PATCH /api/media/:id
   * 目前支持 name/duration 字段可选更新
   */
  fastify.patch<{
    Params: { id: string };
    Body: { duration?: number; name?: string };
  }>("/api/media/:id", async (request, reply) => {
    const { id } = request.params;
    const { duration, name } = request.body || {};
    // 构建需要更新的字段
    const updates: { duration?: number; name?: string } = {};
    if (duration != null && typeof duration === "number" && duration >= 0) {
      updates.duration = duration;
    }
    if (name != null && typeof name === "string") {
      updates.name = name;
    }
    // 更新数据库记录
    const record = updateRecord(id, updates);
    if (!record) {
      // 未找到则返回 404
      return reply.status(404).send({ error: "记录不存在" });
    }
    // 返回更新后的记录
    return record;
  });

  /**
   * 删除指定媒体及其物理文件
   * DELETE /api/media/:id
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/media/:id",
    async (request, reply) => {
      const { id } = request.params;
      // 删除媒体记录和文件
      const ok = deleteRecord(id, uploadsDir);
      if (!ok) {
        // 未找到则返回 404
        return reply.status(404).send({ error: "记录不存在" });
      }
      // 删除成功
      return { ok: true };
    }
  );
}
