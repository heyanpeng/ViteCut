import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "./db.js";

// 媒体类型定义：视频、图片和音频
export type MediaType = "video" | "image" | "audio";

/** 媒体来源：用户上传、AI 生成、系统自带 */
export type MediaSource = "user" | "ai" | "system";

// 媒体资源记录结构
export interface MediaRecord {
  id: string;
  name: string;
  type: MediaType;
  addedAt: number;
  url: string;
  filename: string;
  duration?: number;
  coverUrl?: string;
  /** 媒体来源，用于在媒体库中标注 */
  source?: MediaSource;
}

function rowToRecord(row: Record<string, unknown>): MediaRecord {
  const rec: MediaRecord = {
    id: row.id as string,
    name: row.name as string,
    type: row.type as MediaType,
    addedAt: Number(row.added_at),
    url: row.url as string,
    filename: row.filename as string,
    duration: row.duration != null ? Number(row.duration) : undefined,
  };
  if (row.cover_url != null && typeof row.cover_url === "string") {
    rec.coverUrl = row.cover_url;
  }
  if (
    row.source === "user" ||
    row.source === "ai" ||
    row.source === "system"
  ) {
    rec.source = row.source;
  }
  return rec;
}

export async function addRecord(
  record: Omit<MediaRecord, "id" | "addedAt">
): Promise<MediaRecord> {
  const id = randomUUID();
  const addedAt = Date.now();
  const source = record.source ?? "user";
  await db.query(
    `INSERT INTO media (id, name, type, added_at, url, filename, duration, cover_url, source)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
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
    ]
  );
  return { ...record, id, addedAt, source };
}

export async function listRecords(options?: {
  type?: MediaType;
  search?: string;
  page?: number;
  limit?: number;
  addedAtSince?: number;
  addedAtUntil?: number;
}): Promise<{ items: MediaRecord[]; total: number }> {
  const conditions: string[] = [];
  const params: unknown[] = [];

  if (options?.type) {
    conditions.push("type = ?");
    params.push(options.type);
  }
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

  const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";
  const countSql = `SELECT COUNT(*) as total FROM media ${where}`;
  const [countRows] = await db.query<RowDataPacket[]>(countSql, params);
  const totalCount = Number((countRows?.[0] as { total: number })?.total ?? 0);

  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = (page - 1) * limit;

  const listSql = `SELECT * FROM media ${where} ORDER BY added_at DESC LIMIT ? OFFSET ?`;
  const [rows] = await db.query<RowDataPacket[]>(listSql, [
    ...params,
    limit,
    offset,
  ]);

  const items = (rows ?? []).map((r) => rowToRecord(r as Record<string, unknown>));
  return { items, total: totalCount };
}

export async function getRecord(id: string): Promise<MediaRecord | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM media WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToRecord(row as Record<string, unknown>) : null;
}

export async function updateRecord(
  id: string,
  updates: Partial<Pick<MediaRecord, "duration" | "name">>
): Promise<MediaRecord | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.duration != null && typeof updates.duration === "number") {
    sets.push("duration = ?");
    params.push(updates.duration);
  }
  if (updates.name != null && typeof updates.name === "string") {
    sets.push("name = ?");
    params.push(updates.name);
  }

  if (sets.length === 0) return getRecord(id);

  params.push(id);
  const [result] = await db.query(
    `UPDATE media SET ${sets.join(", ")} WHERE id = ?`,
    params
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  return affected ? getRecord(id) : null;
}

export async function deleteRecord(
  id: string,
  uploadsDir: string
): Promise<boolean> {
  const record = await getRecord(id);
  if (!record) return false;

  // 外部 URL 无本地文件，仅删记录
  const isExternal =
    record.url.startsWith("http://") || record.url.startsWith("https://");
  if (!isExternal && record.filename) {
    const filepath = path.join(uploadsDir, record.filename);
    if (fs.existsSync(filepath)) {
      fs.unlinkSync(filepath);
    }
  }
  if (!isExternal && record.coverUrl) {
    const raw = record.coverUrl;
    const coverRel =
      raw.startsWith("/uploads/") ? raw.slice("/uploads/".length) :
      raw.startsWith("uploads/") ? raw.slice("uploads/".length) : "";
    if (coverRel) {
      const coverPath = path.join(uploadsDir, coverRel);
      if (fs.existsSync(coverPath)) {
        fs.unlinkSync(coverPath);
      }
    }
  }

  const [result] = await db.query("DELETE FROM media WHERE id = ?", [id]);
  const affected = (result as ResultSetHeader)?.affectedRows;
  return (affected ?? 0) > 0;
}
