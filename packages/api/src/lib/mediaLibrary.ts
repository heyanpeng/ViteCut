import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";

// 媒体类型定义：视频、图片和音频
export type MediaType = "video" | "image" | "audio";

// 媒体资源记录结构
export interface MediaRecord {
  id: string; // 资源唯一标识
  name: string; // 资源名称
  type: MediaType; // 资源类型
  addedAt: number; // 添加时间（时间戳）
  url: string; // 资源的访问 URL
  filename: string; // 存储的文件名
  duration?: number; // （可选）媒体时长，仅适用于视频/音频
}

// 媒体数据库路径（JSON 文件）
const MEDIA_DB_PATH = path.join(process.cwd(), "data", "media.json");

// 确保数据库目录存在，如不存在则自动创建
function ensureDataDir(): void {
  const dir = path.dirname(MEDIA_DB_PATH);
  fs.mkdirSync(dir, { recursive: true });
}

// 载入全部媒体资源记录列表
function loadRecords(): MediaRecord[] {
  ensureDataDir();
  try {
    const raw = fs.readFileSync(MEDIA_DB_PATH, "utf-8");
    const data = JSON.parse(raw);
    // 确保数据为数组，否则返回空数组
    return Array.isArray(data.records) ? data.records : [];
  } catch {
    // 文件不存在或解析失败时返回空数组
    return [];
  }
}

// 将所有资源记录写回 JSON 数据库文件
function saveRecords(records: MediaRecord[]): void {
  ensureDataDir();
  fs.writeFileSync(
    MEDIA_DB_PATH,
    JSON.stringify({ records, updatedAt: Date.now() }, null, 2)
  );
}

// 添加新媒体记录，自动生成 id 和添加时间
export function addRecord(
  record: Omit<MediaRecord, "id" | "addedAt">
): MediaRecord {
  const records = loadRecords();
  const now = Date.now();
  const newRecord: MediaRecord = {
    ...record,
    id: randomUUID(), // 生成新的唯一 ID
    addedAt: now, // 记录添加时间
  };
  records.push(newRecord);
  saveRecords(records);
  return newRecord;
}

// 列出媒体资源（支持类型筛选、搜索、分页、按添加时间筛选）
export function listRecords(options?: {
  type?: MediaType; // 资源类型筛选
  search?: string; // 名称模糊搜索
  page?: number; // 页码（默认为 1）
  limit?: number; // 每页数量（默认 20，最大 100）
  addedAtSince?: number; // 起始时间戳筛选
  addedAtUntil?: number; // 结束时间戳筛选
}): { items: MediaRecord[]; total: number } {
  let records = loadRecords();

  // 按类型筛选
  if (options?.type) {
    records = records.filter((r) => r.type === options.type);
  }

  // 按名称模糊搜索
  if (options?.search?.trim()) {
    const q = options.search.trim().toLowerCase();
    records = records.filter((r) => r.name.toLowerCase().includes(q));
  }

  // 添加时间下限筛选
  if (options?.addedAtSince != null) {
    records = records.filter((r) => r.addedAt >= options.addedAtSince!);
  }
  // 添加时间上限筛选
  if (options?.addedAtUntil != null) {
    records = records.filter((r) => r.addedAt <= options.addedAtUntil!);
  }

  const total = records.length;

  // 分页
  const page = Math.max(1, options?.page ?? 1);
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const start = (page - 1) * limit;
  const items = records.slice(start, start + limit);

  return { items, total };
}

// 根据 id 获取单条媒体资源记录
export function getRecord(id: string): MediaRecord | null {
  const records = loadRecords();
  return records.find((r) => r.id === id) ?? null;
}

// 更新指定媒体记录（目前仅支持时长和名称字段）
export function updateRecord(
  id: string,
  updates: Partial<Pick<MediaRecord, "duration" | "name">>
): MediaRecord | null {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return null;
  // 合并更新
  records[idx] = { ...records[idx], ...updates };
  saveRecords(records);
  return records[idx];
}

// 删除指定媒体记录及其文件（如果存在物理文件）
export function deleteRecord(id: string, uploadsDir: string): boolean {
  const records = loadRecords();
  const idx = records.findIndex((r) => r.id === id);
  if (idx < 0) return false;
  const record = records[idx];
  const filepath = path.join(uploadsDir, record.filename);
  // 删除物理文件
  if (fs.existsSync(filepath)) {
    fs.unlinkSync(filepath);
  }
  // 从 records 中移除数据并保存
  records.splice(idx, 1);
  saveRecords(records);
  return true;
}
