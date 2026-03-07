import path from "node:path";
import fs from "node:fs";
import os from "node:os";
import type { FastifyInstance } from "fastify";
import type { StorageAdapter } from "@vitecut/storage";
import {
  addRecord,
  listRecords,
  getRecord,
  updateRecord,
  deleteRecord,
  type MediaMeta,
  type MediaRecord,
} from "../lib/mediaLibrary.js";
import { requireAuth } from "../lib/requireAuth.js";
import { generateWaveform } from "../lib/audioWaveform.js";
import {
  generateVideoThumbnail,
  getVideoDuration,
} from "../lib/videoThumbnail.js";

/**
 * 读取签名URL缓存项
 */
interface SignedReadUrlCacheEntry {
  url: string; // 已生成的签名读取地址
  expiresAt: number; // 过期时间（毫秒）
}

/**
 * 读取签名URL缓存（进程内）：
 * - key: objectKey
 * - value: 对应签名URL及过期时间
 *
 * 目的：同一资源在签名有效期内返回稳定 URL，避免前端反复因为 query 变化重拉资源。
 */
const signedReadUrlCache = new Map<string, SignedReadUrlCacheEntry>();

/**
 * 获取可复用的签名读取 URL
 *
 * 在 URL 过期前复用缓存，临近过期（预留 5 秒）再重新签名，平衡稳定性与可用性。
 */
async function getStableSignedReadUrl(
  readSigner: StorageAdapter & {
    createSignedReadUrl: (input: {
      objectKey: string;
      expiresInSeconds?: number;
    }) => Promise<string>;
  },
  objectKey: string,
  expiresInSeconds: number
): Promise<string> {
  const now = Date.now();
  const cached = signedReadUrlCache.get(objectKey);
  // 预留少量缓冲时间，避免返回“刚好过期”的 URL。
  const renewThresholdMs = 5000;
  if (cached && cached.expiresAt - now > renewThresholdMs) {
    return cached.url;
  }

  const signedUrl = await readSigner.createSignedReadUrl({
    objectKey,
    expiresInSeconds,
  });
  signedReadUrlCache.set(objectKey, {
    url: signedUrl,
    expiresAt: now + expiresInSeconds * 1000,
  });
  return signedUrl;
}

/**
 * 统一生成可访问地址：
 * - OSS 私有对象（filename/coverUrl 对应 objectKey）返回 GET 临时签名 URL
 */
async function withAccessibleUrl<
  T extends { url?: string; coverUrl?: string; filename?: string },
>(
  record: T,
  storage: StorageAdapter,
  readUrlExpiresSeconds: number
): Promise<T> {
  const result = { ...record };
  const readSigner = storage as StorageAdapter & {
    createSignedReadUrl: (input: {
      objectKey: string;
      expiresInSeconds?: number;
    }) => Promise<string>;
  };

  if (result.filename) {
    result.url = await getStableSignedReadUrl(
      readSigner,
      result.filename,
      readUrlExpiresSeconds
    );
  }

  if (result.coverUrl) {
    const coverKey = storage.extractObjectKey(result.coverUrl);
    if (coverKey) {
      result.coverUrl = await getStableSignedReadUrl(
        readSigner,
        coverKey,
        readUrlExpiresSeconds
      );
    }
  }

  return result;
}

/**
 * 根据mimetype或文件名后缀推断媒体类型(video/image/audio)，推断不出时默认video
 */
function inferType(mimetype?: string, filename?: string): MediaRecord["type"] {
  const t = mimetype ?? "";
  if (t.startsWith("video/")) return "video";
  if (t.startsWith("image/")) return "image";
  if (t.startsWith("audio/")) return "audio";
  const ext = path.extname(filename || "").toLowerCase();
  if ([".mp4", ".webm", ".mov", ".avi", ".mkv"].includes(ext)) return "video";
  if ([".jpg", ".jpeg", ".png", ".gif", ".webp", ".bmp"].includes(ext))
    return "image";
  if ([".mp3", ".wav", ".aac", ".ogg", ".flac", ".m4a"].includes(ext))
    return "audio";
  return "video";
}

/**
 * 使用临时目录执行一个异步函数, 结束后删除临时目录
 */
async function withTempDir<T>(fn: (dir: string) => Promise<T>): Promise<T> {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "vitecut-media-complete-"));
  try {
    return await fn(dir);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * 媒体路由参数配置接口
 */
export interface MediaRoutesOptions {
  storage: StorageAdapter;
}

/**
 * 注册媒体相关路由
 */
export async function mediaRoutes(
  fastify: FastifyInstance,
  opts: MediaRoutesOptions
): Promise<void> {
  const { storage } = opts;
  const rawReadUrlExpiresSeconds = Number.parseInt(
    process.env.OSS_READ_URL_EXPIRES_SECONDS || "",
    10
  );
  /**
   * 读取签名 URL 有效时长，统一由环境变量控制，默认900秒，最大3600，最小60
   */
  const readUrlExpiresSeconds = Number.isFinite(rawReadUrlExpiresSeconds)
    ? Math.max(60, Math.min(3600, rawReadUrlExpiresSeconds))
    : 900;

  /**
   * 获取文件上传的签名URL
   */
  fastify.post<{
    Body: {
      filename?: string;
      contentType?: string;
      type?: "video" | "image" | "audio";
    };
  }>(
    "/api/storage/upload-url",
    { preHandler: requireAuth },
    async (request, reply) => {
      const { filename, contentType, type } = request.body ?? {};
      if (!filename || typeof filename !== "string") {
        return reply.status(400).send({ error: "缺少 filename" });
      }
      const mediaType = type ?? inferType(contentType, filename);
      const objectKey = storage.buildObjectKey("user", filename);
      const signed = await storage.createSignedUploadUrl({
        objectKey,
        contentType: contentType || "application/octet-stream",
        expiresInSeconds: 900,
      });
      return {
        ...signed,
        mediaType,
      };
    }
  );

  /**
   * 上传完成后写入媒体库；会对视频补全时长和封面，对音频补全波形图
   */
  fastify.post<{
    Body: {
      objectKey?: string;
      url?: string;
      name?: string;
      type?: "video" | "image" | "audio";
      mimetype?: string;
      duration?: number;
      coverUrl?: string;
      meta?: MediaMeta;
      source?: "user" | "ai" | "system";
    };
  }>(
    "/api/media/complete",
    { preHandler: requireAuth },
    async (request, reply) => {
      // 前端直传完成后由该接口负责落库，保证记录结构与后端上传一致。
      const {
        objectKey,
        name,
        type,
        mimetype,
        duration,
        coverUrl,
        meta,
        source,
      } = request.body ?? {};
      if (!objectKey || typeof objectKey !== "string") {
        return reply.status(400).send({ error: "缺少 objectKey" });
      }
      const mediaType = type ?? inferType(mimetype, objectKey);
      let finalDuration =
        duration != null && duration >= 0 ? duration : undefined;
      let finalCoverUrl = coverUrl || undefined;
      const finalMeta: MediaMeta = meta ? { ...meta } : {};
      if (!finalMeta.common) {
        finalMeta.common = {};
      }
      if (mimetype) {
        finalMeta.common.mimeType = mimetype;
      }

      // 后端仅兜底补全：前端已上传的时长/封面优先使用。
      const needVideoDuration =
        mediaType === "video" &&
        (finalDuration == null || Number.isNaN(finalDuration));
      const needVideoCover = mediaType === "video" && !finalCoverUrl;
      const needAudioWaveform = mediaType === "audio" && !finalCoverUrl;

      if (needVideoDuration || needVideoCover || needAudioWaveform) {
        try {
          const objectBuffer = await storage.getBuffer(objectKey);
          await withTempDir(async (tempDir) => {
            const ext =
              path.extname(objectKey) ||
              (mediaType === "video" ? ".mp4" : ".mp3");
            const sourcePath = path.join(tempDir, `source${ext}`);
            fs.writeFileSync(sourcePath, objectBuffer);

            if (mediaType === "video") {
              // 自动推断视频时长
              if (needVideoDuration) {
                const videoDuration = await getVideoDuration(sourcePath);
                if (videoDuration != null) {
                  finalDuration = videoDuration;
                }
              }
              // 自动生成视频封面
              if (needVideoCover) {
                const coverPath = path.join(tempDir, "cover.png");
                const ok = await generateVideoThumbnail(
                  sourcePath,
                  coverPath,
                  0.5
                );
                if (ok && fs.existsSync(coverPath)) {
                  const uploadedCover = await storage.putBuffer({
                    objectKey: storage.buildObjectKey(
                      "user",
                      `${path.basename(objectKey, ext)}_cover.png`
                    ),
                    buffer: fs.readFileSync(coverPath),
                    contentType: "image/png",
                  });
                  finalCoverUrl = uploadedCover.url;
                }
              }
            } else if (needAudioWaveform) {
              // 自动生成音频波形图作为cover
              const waveformPath = path.join(tempDir, "waveform.png");
              const ok = await generateWaveform(
                sourcePath,
                waveformPath,
                120,
                40
              );
              if (ok && fs.existsSync(waveformPath)) {
                const uploadedWaveform = await storage.putBuffer({
                  objectKey: storage.buildObjectKey(
                    "user",
                    `${path.basename(objectKey, ext)}_waveform.png`
                  ),
                  buffer: fs.readFileSync(waveformPath),
                  contentType: "image/png",
                });
                finalCoverUrl = uploadedWaveform.url;
              }
            }
          });
        } catch (err) {
          request.log.warn(
            { err, objectKey },
            "生成媒体元数据失败，按基础记录入库"
          );
        }
      }

      const userId = (request as { user?: { userId: string } }).user?.userId;
      if (mediaType === "video") {
        finalMeta.video = {
          ...(finalMeta.video ?? {}),
          ...(finalDuration != null ? { duration: finalDuration } : {}),
        };
      } else if (mediaType === "audio") {
        finalMeta.audio = {
          ...(finalMeta.audio ?? {}),
          ...(finalDuration != null ? { duration: finalDuration } : {}),
        };
      }
      const record = await addRecord(
        {
          name: name || path.basename(objectKey),
          type: mediaType,
          // 统一由后端根据 objectKey 生成标准 OSS 地址，避免前端传入旧格式 URL。
          url: storage.getPublicUrl(objectKey),
          filename: objectKey,
          duration: finalDuration,
          coverUrl: finalCoverUrl,
          meta: finalMeta,
          source: source ?? "user",
        },
        userId
      );
      return withAccessibleUrl(record, storage, readUrlExpiresSeconds);
    }
  );

  /**
   * 通过指定外部url写入媒体库
   */
  fastify.post<{
    Body: {
      url: string;
      name?: string;
      type?: "video" | "image" | "audio";
      source?: "user" | "ai" | "system";
      duration?: number;
      coverUrl?: string;
      meta?: MediaMeta;
    };
  }>(
    "/api/media/from-url",
    { preHandler: requireAuth },
    async (request, reply) => {
      const {
        url,
        name,
        type: bodyType,
        source: bodySource,
        duration,
        coverUrl,
        meta,
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

      const type = bodyType ?? inferType(undefined, parsedUrl.pathname);
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
          filename: "",
          coverUrl: coverUrl || undefined,
          duration: duration != null && duration >= 0 ? duration : undefined,
          meta,
          source: bodySource ?? "user",
        },
        userId
      );

      return withAccessibleUrl(record, storage, readUrlExpiresSeconds);
    }
  );

  /**
   * 查询媒体列表，支持type/filter/pagination等参数
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
    const items = await Promise.all(
      result.items.map((r) =>
        withAccessibleUrl(r, storage, readUrlExpiresSeconds)
      )
    );
    return {
      items,
      total: result.total,
    };
  });

  /**
   * 修改媒体属性，仅支持修改duration、name
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
    const record =
      updates.duration !== undefined || updates.name !== undefined
        ? await updateRecord(id, updates)
        : existing;
    if (!record) {
      return reply.status(404).send({ error: "记录不存在" });
    }
    return withAccessibleUrl(record, storage, readUrlExpiresSeconds);
  });

  /**
   * 删除媒体，id必须为本人
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
      const ok = await deleteRecord(id, storage);
      if (!ok) {
        return reply.status(404).send({ error: "记录不存在" });
      }
      return { ok: true };
    }
  );
}
