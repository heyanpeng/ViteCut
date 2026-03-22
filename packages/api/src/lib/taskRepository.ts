import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "./db.js";

/** 任务状态，表示任务的当前进度阶段 */
export type TaskStatus = "pending" | "running" | "success" | "failed";

/** 任务类型，表示任务的不同业务类别 */
export type TaskType =
  | "export"
  | "ai-image"
  | "ai-video"
  | "ai-audio"
  | "ai-tts"
  | "other";

/** 结果项：可含 objectKey/url，可扩展其他信息 */
export interface TaskResult {
  objectKey?: string;
  url?: string;
  [key: string]: unknown; // 可扩展的额外数据
}

/** 数据库行结构（snake_case），直接映射到 MySQL 表结构 */
export interface TaskRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  label: string;
  progress: number | null;
  message: string | null;
  results: string | null; // JSON 字符串，内容为 TaskResult[]
  created_at: number;
  updated_at: number;
}

/** API 返回结构（驼峰），对外暴露给前端/客户端用 */
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  progress?: number; // 可选：任务进度
  message?: string; // 可选：状态描述信息
  results?: TaskResult[]; // 可选：任务结果
  createdAt: number;
  updatedAt: number;
}

/**
 * 数据库行转为 API Task 对象（snake_case => camelCase），并解析结果字段
 * @param row 数据库行
 */
function rowToTask(row: Record<string, unknown>): Task {
  const task: Task = {
    id: row.id as string,
    type: row.type as TaskType,
    status: row.status as TaskStatus,
    label: row.label as string,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
  if (row.progress != null && typeof row.progress === "number") {
    task.progress = row.progress;
  }
  if (row.message != null && typeof row.message === "string") {
    task.message = row.message;
  }
  if (row.results != null && typeof row.results === "string") {
    try {
      const parsed = JSON.parse(row.results) as TaskResult[];
      if (Array.isArray(parsed)) {
        task.results = parsed;
      }
    } catch {
      // 忽略解析错误，如果结果不是有效 JSON，则不设 results 字段
    }
  }
  return task;
}

/**
 * Task 对象 + 时间戳转为数据库 TaskRow（camelCase => snake_case）
 * （注意需额外指定 userId，不能直接由 Task 提供）
 */
function _taskToRow(
  task: Omit<Task, "createdAt" | "updatedAt">,
  createdAt: number,
  updatedAt: number
): TaskRow {
  return {
    id: task.id,
    user_id: "", // 由调用方传入正确 user_id
    type: task.type,
    status: task.status,
    label: task.label,
    progress: task.progress ?? null,
    message: task.message ?? null,
    results: task.results ? JSON.stringify(task.results) : null,
    created_at: createdAt,
    updated_at: updatedAt,
  };
}

/**
 * 查询指定用户的任务列表
 * @param userId 用户ID
 * @param options 可选：limit数量、offset偏移
 * @returns { items, total } 任务列表和总数量
 */
export async function listByUserId(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ items: Task[]; total: number }> {
  // 限制分页参数范围
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);

  // 查询任务总数
  const [countRows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM tasks WHERE user_id = ?",
    [userId]
  );
  const total = Number((countRows?.[0] as { total: number })?.total ?? 0);

  // 查询分页任务
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM tasks WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    [userId, limit, offset]
  );

  // 转换为 API 输出结构
  const items = (rows ?? []).map((r) =>
    rowToTask(r as Record<string, unknown>)
  );
  return { items, total };
}

/**
 * 按任务ID查找单条任务
 * @param id 任务ID
 * @returns Task 或 null
 */
export async function findById(id: string): Promise<Task | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToTask(row as Record<string, unknown>) : null;
}

/**
 * 新建任务（插入数据库）
 * @param row 任务行数据（需指定所有必要字段）
 * @returns 新建的 Task 对象
 */
export async function create(
  row: Omit<TaskRow, "created_at" | "updated_at"> & {
    created_at: number;
    updated_at: number;
  }
): Promise<Task> {
  await db.query(
    `INSERT INTO tasks (id, user_id, type, status, label, progress, message, results, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      row.id,
      row.user_id,
      row.type,
      row.status,
      row.label,
      row.progress,
      row.message,
      row.results,
      row.created_at,
      row.updated_at,
    ]
  );
  return findById(row.id) as Promise<Task>;
}

/**
 * 更新指定任务的内容，仅允许部分字段可变
 * @param id 任务ID
 * @param userId 用户ID（确保只能改自己的任务）
 * @param updates 可更新的字段集合
 * @returns 更新时间戳或 null（无权限/未更新）
 */
export async function update(
  id: string,
  userId: string,
  updates: Partial<
    Pick<TaskRow, "status" | "progress" | "message" | "results" | "label">
  >
): Promise<number | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.status != null) {
    sets.push("status = ?");
    params.push(updates.status);
  }
  if (updates.progress !== undefined) {
    sets.push("progress = ?");
    params.push(updates.progress);
  }
  if (updates.message !== undefined) {
    sets.push("message = ?");
    params.push(updates.message);
  }
  if (updates.results !== undefined) {
    sets.push("results = ?");
    params.push(updates.results);
  }
  if (updates.label != null) {
    sets.push("label = ?");
    params.push(updates.label);
  }

  // 未指定需要更新内容则直接返回最新时间（不做 DB 操作）
  if (sets.length === 0) {
    const existing = await findById(id);
    return existing ? existing.updatedAt : null;
  }

  // 更新更新时间
  sets.push("updated_at = ?");
  params.push(Date.now());
  // 主键参数
  params.push(id, userId);

  // 拼 SQL
  const [result] = await db.query(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  if (affected === 0) return null;
  return Date.now();
}

/**
 * 删除指定 ID/用户的任务（权限不可越权）
 * @param id 任务ID
 * @param userId 用户ID
 */
export async function deleteTask(id: string, userId: string): Promise<boolean> {
  const [result] = await db.query(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  return (affected ?? 0) > 0;
}

/**
 * 清理用户的全部或部分任务
 * @param userId 用户ID
 * @param options.completedOnly 仅清理已完成/失败任务（否则全部清空）
 * @returns 实际影响行数
 */
export async function clearByUserId(
  userId: string,
  options?: { completedOnly?: boolean }
): Promise<number> {
  let sql = "DELETE FROM tasks WHERE user_id = ?";
  const params: unknown[] = [userId];

  // 只删除已完成（success/failed）任务
  if (options?.completedOnly) {
    sql += " AND (status = 'success' OR status = 'failed')";
  }

  const [result] = await db.query(sql, params);
  const affected = (result as ResultSetHeader)?.affectedRows;
  return affected ?? 0;
}
