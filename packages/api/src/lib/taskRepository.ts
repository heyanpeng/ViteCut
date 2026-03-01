import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { db } from "./db.js";

/** 任务状态 */
export type TaskStatus = "pending" | "running" | "success" | "failed";

/** 任务类型 */
export type TaskType =
  | "export"
  | "ai-image"
  | "ai-video"
  | "ai-audio"
  | "ai-tts"
  | "other";

/** 结果项：至少含 url，可含其他扩展信息 */
export interface TaskResult {
  url: string;
  [key: string]: unknown;
}

/** 数据库行结构（snake_case） */
export interface TaskRow {
  id: string;
  user_id: string;
  type: string;
  status: string;
  label: string;
  progress: number | null;
  message: string | null;
  results: string | null; // JSON 字符串
  created_at: number;
  updated_at: number;
}

/** API 返回结构（驼峰） */
export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  progress?: number;
  message?: string;
  results?: TaskResult[];
  createdAt: number;
  updatedAt: number;
}

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
      // 忽略解析错误
    }
  }
  return task;
}

function _taskToRow(
  task: Omit<Task, "createdAt" | "updatedAt">,
  createdAt: number,
  updatedAt: number
): TaskRow {
  return {
    id: task.id,
    user_id: "", // 由调用方传入
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

export async function listByUserId(
  userId: string,
  options?: { limit?: number; offset?: number }
): Promise<{ items: Task[]; total: number }> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);

  const [countRows] = await db.query<RowDataPacket[]>(
    "SELECT COUNT(*) as total FROM tasks WHERE user_id = ?",
    [userId]
  );
  const total = Number((countRows?.[0] as { total: number })?.total ?? 0);

  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM tasks WHERE user_id = ? ORDER BY updated_at DESC LIMIT ? OFFSET ?",
    [userId, limit, offset]
  );

  const items = (rows ?? []).map((r) =>
    rowToTask(r as Record<string, unknown>)
  );
  return { items, total };
}

export async function findById(id: string): Promise<Task | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM tasks WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToTask(row as Record<string, unknown>) : null;
}

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

  if (sets.length === 0) {
    const existing = await findById(id);
    return existing ? existing.updatedAt : null;
  }

  sets.push("updated_at = ?");
  params.push(Date.now());
  params.push(id, userId);

  const [result] = await db.query(
    `UPDATE tasks SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  if (affected === 0) return null;
  return Date.now();
}

export async function deleteTask(
  id: string,
  userId: string
): Promise<boolean> {
  const [result] = await db.query(
    "DELETE FROM tasks WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  const affected = (result as ResultSetHeader)?.affectedRows;
  return (affected ?? 0) > 0;
}

export async function clearByUserId(
  userId: string,
  options?: { completedOnly?: boolean }
): Promise<number> {
  let sql = "DELETE FROM tasks WHERE user_id = ?";
  const params: unknown[] = [userId];

  if (options?.completedOnly) {
    sql += " AND (status = 'success' OR status = 'failed')";
  }

  const [result] = await db.query(sql, params);
  const affected = (result as ResultSetHeader)?.affectedRows;
  return affected ?? 0;
}
