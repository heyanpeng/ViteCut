import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import type { StorageAdapter } from "@vitecut/storage";
import { db } from "./db.js";

/**
 * 媒体类型定义：视频、图片和音频
 */
export type MediaType = "video" | "image" | "audio";

/**
 * 媒体来源：用户上传、AI 生成、系统自带
 */
export type MediaSource = "user" | "ai" | "system";

/**
 * 媒体扩展元信息（按媒体类型分组）。
 */
export interface MediaMeta {
  common?: {
    mimeType?: string;
    sizeBytes?: number;
  };
  image?: {
    width: number;
    height: number;
  };
  video?: {
    width?: number;
    height?: number;
    duration?: number;
    fps?: number;
    codec?: string;
    rotation?: number;
    hasAudio?: boolean;
  };
  audio?: {
    duration?: number;
    sampleRate?: number;
    channels?: number;
    codec?: string;
    bitrate?: number;
  };
}

/**
 * 媒体资源记录结构
 */
export interface MediaRecord {
  id: string; // 媒体记录唯一ID
  name: string; // 媒体名称
  type: MediaType; // 媒体类型
  addedAt: number; // 添加时间戳
  url: string; // 资源外部访问URL
  filename: string; // 存储对象名
  duration?: number; // 时长，部分媒体如音频/视频可能存在
  coverUrl?: string; // 封面图片URL
  /** 媒体来源，用于在媒体库中标注 */
  source?: MediaSource; // 媒体来源：用户/AI/系统
  /** 所属用户 id，NULL 表示历史数据未关联 */
  userId?: string | null; // 所属用户ID
  /** 扩展元信息（图片/视频/音频） */
  meta?: MediaMeta;
}

/**
 * 数据库行到媒体记录对象的转换
 * @param row 数据库返回的对象
 * @returns MediaRecord
 */
function rowToRecord(row: Record<string, unknown>): MediaRecord {
  // 基本字段直接映射
  const rec: MediaRecord = {
    id: row.id as string,
    name: row.name as string,
    type: row.type as MediaType,
    addedAt: Number(row.added_at),
    url: row.url as string,
    filename: row.filename as string,
    duration: row.duration != null ? Number(row.duration) : undefined,
  };
  // 可选的cover
  if (row.cover_url != null && typeof row.cover_url === "string") {
    rec.coverUrl = row.cover_url;
  }
  // 来源限定为三类之一
  if (row.source === "user" || row.source === "ai" || row.source === "system") {
    rec.source = row.source;
  }
  // 用户id处理：既可为字符串也可为null
  if (row.user_id != null && typeof row.user_id === "string") {
    rec.userId = row.user_id;
  } else if (row.user_id === null) {
    rec.userId = null;
  }
  // 媒体扩展元信息：优先支持字符串 JSON，兼容驱动直接返回对象
  const rawMeta = row.meta_json;
  if (typeof rawMeta === "string" && rawMeta.trim().length > 0) {
    try {
      rec.meta = JSON.parse(rawMeta) as MediaMeta;
    } catch {
      // 忽略异常 meta 数据，避免影响主流程
    }
  } else if (rawMeta && typeof rawMeta === "object") {
    rec.meta = rawMeta as MediaMeta;
  }
  return rec;
}

/**
 * 新增媒体记录
 * @param record 不包含id、addedAt、userId的媒体记录对象
 * @param userId 用户id
 * @returns 添加后的完整媒体记录对象
 */
export async function addRecord(
  record: Omit<MediaRecord, "id" | "addedAt" | "userId">,
  userId?: string | null
): Promise<MediaRecord> {
  const id = randomUUID(); // 生成唯一ID
  const addedAt = Date.now(); // 时间戳
  const source = record.source ?? "user"; // 来源，默认为用户
  // 插入数据库
  await db.query(
    `INSERT INTO media (id, name, type, added_at, url, filename, duration, cover_url, source, user_id, meta_json)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      record.name,
      record.type,
      addedAt,
      record.url,
      record.filename,
      record.duration ?? null,
      record.coverUrl ?? null,
      source,
      userId ?? null,
      record.meta ? JSON.stringify(record.meta) : null,
    ]
  );
  // 返回插入后的完整对象
  return { ...record, id, addedAt, source, userId: userId ?? null };
}

/**
 * 查询媒体记录列表，支持类型、搜索、分页等
 * @param options 查询参数
 * @returns items为媒体记录数组，total为总数
 */
export async function listRecords(options?: {
  type?: MediaType;
  search?: string;
  page?: number;
  limit?: number;
  addedAtSince?: number;
  addedAtUntil?: number;
  /** 只返回该用户关联的媒体（未传则不按用户过滤） */
  userId?: string;
}): Promise<{ items: MediaRecord[]; total: number }> {
  const conditions: string[] = []; // SQL筛选条件
  const params: unknown[] = []; // 占位符参数

  // 条件拼装
  if (options?.userId != null && options.userId !== "") {
    conditions.push("user_id = ?");
    params.push(options.userId);
  }
  if (options?.type) {
    conditions.push("type = ?");
    params.push(options.type);
  }
  // LIKE 搜索，转义部分通配符
  if (options?.search?.trim()) {
    conditions.push("name LIKE ?");
    const q = options.search.trim().replace(/[%_\\]/g, "\\$&");
    params.push(`%${q}%`);
  }
  if (options?.addedAtSince != null) {
    conditions.push("added_at >= ?");
    params.push(options.addedAtSince);
  }
  if (options?.addedAtUntil != null) {
    conditions.push("added_at <= ?");
    params.push(options.addedAtUntil);
  }

  // SQL语句拼接
  const where =
    conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  // 查询总数
  const countSql = `SELECT COUNT(*) as total FROM media ${where}`;
  const [countRows] = await db.query<RowDataPacket[]>(countSql, params);
  const totalCount = Number((countRows?.[0] as { total: number })?.total ?? 0);

  // 分页参数
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20)); // 限制最大每页100条
  const offset = (page - 1) * limit;

  // 查询数据
  const listSql = `SELECT * FROM media ${where} ORDER BY added_at DESC LIMIT ? OFFSET ?`;
  const [rows] = await db.query<RowDataPacket[]>(listSql, [
    ...params,
    limit,
    offset,
  ]);

  // 数据库行转对象
  const items = (rows ?? []).map((r) =>
    rowToRecord(r as Record<string, unknown>)
  );
  // 返回结果
  return { items, total: totalCount };
}

/**
 * 根据id获取单个媒体记录
 * @param id 媒体记录id
 * @returns 找到则返回MediaRecord，否则返回null
 */
export async function getRecord(id: string): Promise<MediaRecord | null> {
  // 通过主键查找
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM media WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToRecord(row as Record<string, unknown>) : null;
}

/**
 * 更新媒体记录（仅支持duration和name字段）
 * @param id 媒体记录id
 * @param updates 包含要更新的字段
 * @returns 更新后的媒体记录对象，失败返回null
 */
export async function updateRecord(
  id: string,
  updates: Partial<Pick<MediaRecord, "duration" | "name">>
): Promise<MediaRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  // 仅可更新时长和名称字段
  if (updates.duration != null && typeof updates.duration === "number") {
    sets.push("duration = ?");
    params.push(updates.duration);
  }
  if (updates.name != null && typeof updates.name === "string") {
    sets.push("name = ?");
    params.push(updates.name);
  }

  // 如果没有实际需要更新的内容，直接取旧值返回
  if (sets.length === 0) return getRecord(id);

  params.push(id);
  // 执行更新操作
  const [result] = await db.query(
    `UPDATE media SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  // 若更新成功，返回最新对象，否则返回null
  return affected ? getRecord(id) : null;
}

/**
 * 删除媒体记录，会顺带删除存储中的对象（filename/cover），
 * 存储删除失败不影响数据库记录删除
 * @param id 媒体记录id
 * @param storage 存储适配器对象
 * @returns 是否成功删除
 */
export async function deleteRecord(
  id: string,
  storage: StorageAdapter
): Promise<boolean> {
  // 先查询记录
  const record = await getRecord(id);
  if (!record) return false;

  // 先尝试删除主文件
  if (record.filename) {
    try {
      await storage.deleteObject(record.filename);
    } catch {
      // 存储对象删除失败不阻塞记录删除
    }
  }
  // 然后尝试删除封面图
  if (record.coverUrl) {
    const coverKey = storage.extractObjectKey(record.coverUrl);
    // 避免和主文件重复删除
    if (coverKey && coverKey !== record.filename) {
      try {
        await storage.deleteObject(coverKey);
      } catch {
        // 存储对象删除失败不阻塞记录删除
      }
    }
  }

  // 删除数据库记录
  const [result] = await db.query("DELETE FROM media WHERE id = ?", [id]);
  const affected = (result as ResultSetHeader)?.affectedRows;
  return (affected ?? 0) > 0;
}
