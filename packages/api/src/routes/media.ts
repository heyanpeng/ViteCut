import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import {
  addRecord,
  listRecords,
  getRecord,
  updateRecord,
  deleteRecord,
  type MediaRecord,
} from "../lib/mediaLibrary.js";
import { requireAuth } from "../lib/requireAuth.js";
import { getBaseUrl } from "../utils/baseUrl.js";
import { generateWaveform } from "../lib/audioWaveform.js";
import {
  generateVideoThumbnail,
  getVideoDuration,
} from "../lib/videoThumbnail.js";

function withAbsoluteUrl<T extends { url?: string; coverUrl?: string }>(
  record: T,
  baseUrl: string
): T {
  const base = baseUrl.replace(/\/$/, "");
  const result = { ...record };
  const u = (result as { url?: string }).url ?? "";
  if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
    (result as { url: string }).url =
      `${base}${u.startsWith("/") ? u : `/${u}`}`;
  }
  const c = (result as { coverUrl?: string }).coverUrl ?? "";
  if (c && !c.startsWith("http://") && !c.startsWith("https://")) {
    (result as { coverUrl: string }).coverUrl =
      `${base}${c.startsWith("/") ? c : `/${c}`}`;
  }
  return result;
}

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
   * 返回媒体记录对象（需登录，记录关联当前用户）
   */
  fastify.post("/api/media", { preHandler: requireAuth }, async (request, reply) => {
    // 获取上传的单个文件
    const data = await request.file();
    if (!data) {
      // 未上传文件时返回 400
      return reply.status(400).send({ error: "缺少文件" });
    }

    // 获取扩展名（无则用 .bin）
    const ext = path.extname(data.filename) || ".bin";
    // 随机生成文件名，避免冲突
    const basename = `${randomUUID()}${ext}`;
    // 按年/月/日分目录存储
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    const relPath = `${year}/${month}/${day}/${basename}`;
    const filepath = path.join(uploadsDir, relPath);

    // 确保目录存在并写入
    fs.mkdirSync(path.dirname(filepath), { recursive: true });
    const buffer = await data.toBuffer();
    fs.writeFileSync(filepath, buffer);

    // 使用相对路径入库，filename 存完整相对路径供删除时定位
    const url = `/uploads/${relPath}`;

    // 基于 MIME 类型判定资源类型
    const rawType = data.mimetype ?? "";
    const type = rawType.startsWith("video/")
      ? "video"
      : rawType.startsWith("image/")
        ? "image"
        : rawType.startsWith("audio/")
          ? "audio"
          : ("video" as MediaRecord["type"]); // 默认用 video 类型

    // 音频上传时生成波形图，视频上传时生成封面
    let coverUrl: string | undefined;
    if (type === "audio") {
      const waveformRel = `${year}/${month}/${day}/${path.basename(basename, ext)}_waveform.png`;
      const waveformPath = path.join(uploadsDir, waveformRel);
      const ok = await generateWaveform(filepath, waveformPath, 120, 40);
      if (ok) {
        coverUrl = `/uploads/${waveformRel}`;
      }
    } else if (type === "video") {
      const thumbnailRel = `${year}/${month}/${day}/${path.basename(basename, ext)}_cover.png`;
      const thumbnailPath = path.join(uploadsDir, thumbnailRel);
      const ok = await generateVideoThumbnail(filepath, thumbnailPath, 0.5);
      if (ok) {
        coverUrl = `/uploads/${thumbnailRel}`;
      }
    }

    // 视频上传时解析时长
    let duration: number | undefined;
    if (type === "video") {
      duration = await getVideoDuration(filepath);
    }

    const userId = (request as { user?: { userId: string } }).user?.userId;
    // 添加媒体记录到数据库（来源：用户上传，关联当前用户）
    const record = await addRecord(
      {
        name: data.filename,
        type,
        url,
        filename: relPath,
        coverUrl,
        duration: duration ?? undefined,
        source: "user",
      },
      userId
    );

    // 返回媒体记录，url 拼接为完整地址
    const baseUrl = getBaseUrl(request.headers, port);
    return withAbsoluteUrl(record, baseUrl);
  });

  /**
   * 添加第三方资源到媒体库（仅入库，不拉取文件；需登录，记录关联当前用户）
   * POST /api/media/from-url
   * Body: { url: string; name?: string; type?: "video"|"image"|"audio"; source?: "user"|"ai"|"system"; duration?: number; coverUrl?: string }
   */
  fastify.post<{
    Body: {
      url: string;
      name?: string;
      type?: "video" | "image" | "audio";
      source?: "user" | "ai" | "system";
      duration?: number;
      coverUrl?: string;
    };
  }>("/api/media/from-url", { preHandler: requireAuth }, async (request, reply) => {
    const {
      url,
      name,
      type: bodyType,
      source: bodySource,
      duration,
      coverUrl,
    } = request.body ?? {};
    if (!url || typeof url !== "string") {
      return reply.status(400).send({ error: "缺少 url" });
    }
    let parsedUrl: URL;
    try {
      parsedUrl = new URL(url);
    } catch {
      return reply.status(400).send({ error: "无效的 url" });
    }
    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      return reply.status(400).send({ error: "仅支持 http/https" });
    }

    const ext = path.extname(parsedUrl.pathname);
    const inferredType = ext.match(/\.(mp4|webm|mov|avi|mkv)(\?|$)/i)
      ? ("video" as const)
      : ext.match(/\.(jpg|jpeg|png|gif|webp|bmp)(\?|$)/i)
        ? ("image" as const)
        : ext.match(/\.(mp3|wav|aac|ogg|flac|m4a)(\?|$)/i)
          ? ("audio" as const)
          : ("video" as MediaRecord["type"]);
    const type = bodyType ?? inferredType;

    const recordName =
      name ??
      (decodeURIComponent(
        path.basename(parsedUrl.pathname, path.extname(parsedUrl.pathname))
      ) ||
        "media");

    const userId = (request as { user?: { userId: string } }).user?.userId;
    const record = await addRecord(
      {
        name: recordName,
        type,
        url,
        filename: "", // 外部资源无本地文件
        coverUrl: coverUrl || undefined,
        duration: duration != null && duration >= 0 ? duration : undefined,
        source: bodySource ?? "user",
      },
      userId
    );

    const baseUrl = getBaseUrl(request.headers, port);
    return withAbsoluteUrl(record, baseUrl);
  });

  /**
   * 查询媒体资源列表
   * GET /api/media
   * 需登录，仅返回当前用户关联的媒体；支持类型筛选、搜索、分页、时间范围筛选
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
  }>("/api/media", { preHandler: requireAuth }, async (request) => {
    const userId = (request as { user?: { userId: string } }).user?.userId;
    const { type, search, page, limit, addedAtSince, addedAtUntil } =
      request.query;
    // 校验 type 参数合法性
    const validType =
      type === "video" || type === "image" || type === "audio"
        ? type
        : undefined;

    const result = await listRecords({
      userId,
      type: validType,
      search: search || undefined,
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      addedAtSince: addedAtSince ? parseInt(addedAtSince, 10) : undefined,
      addedAtUntil: addedAtUntil ? parseInt(addedAtUntil, 10) : undefined,
    });
    const baseUrl = getBaseUrl(request.headers, port);
    return {
      items: result.items.map((r) => withAbsoluteUrl(r, baseUrl)),
      total: result.total,
    };
  });

  /**
   * 更新媒体记录
   * PATCH /api/media/:id
   * 需登录，仅可更新当前用户关联的记录；支持 name/duration 字段可选更新
   */
  fastify.patch<{
    Params: { id: string };
    Body: { duration?: number; name?: string };
  }>("/api/media/:id", { preHandler: requireAuth }, async (request, reply) => {
    const { id } = request.params;
    const userId = (request as { user?: { userId: string } }).user?.userId;
    const existing = await getRecord(id);
    if (!existing) {
      return reply.status(404).send({ error: "记录不存在" });
    }
    if (existing.userId !== userId) {
      return reply.status(403).send({ error: "无权限操作该资源" });
    }
    const { duration, name } = request.body || {};
    const updates: { duration?: number; name?: string } = {};
    if (duration != null && typeof duration === "number" && duration >= 0) {
      updates.duration = duration;
    }
    if (name != null && typeof name === "string") {
      updates.name = name;
    }
    const record = updates.duration !== undefined || updates.name !== undefined
      ? await updateRecord(id, updates)
      : existing;
    if (!record) {
      return reply.status(404).send({ error: "记录不存在" });
    }
    const baseUrl = getBaseUrl(request.headers, port);
    return withAbsoluteUrl(record, baseUrl);
  });

  /**
   * 删除指定媒体及其物理文件
   * DELETE /api/media/:id
   * 需登录，仅可删除当前用户关联的记录
   */
  fastify.delete<{ Params: { id: string } }>(
    "/api/media/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { id } = request.params;
      const userId = (request as { user?: { userId: string } }).user?.userId;
      const existing = await getRecord(id);
      if (!existing) {
        return reply.status(404).send({ error: "记录不存在" });
      }
      if (existing.userId !== userId) {
        return reply.status(403).send({ error: "无权限操作该资源" });
      }
      const ok = await deleteRecord(id, uploadsDir);
      if (!ok) {
        return reply.status(404).send({ error: "记录不存在" });
      }
      return { ok: true };
    }
  );
}
