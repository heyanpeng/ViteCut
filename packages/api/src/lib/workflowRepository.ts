import type { RowDataPacket, ResultSetHeader } from "mysql2";
import { randomUUID } from "node:crypto";
import { db } from "./db.js";

export type WorkflowStatus = "idle" | "running" | "failed";

export interface WorkflowRow extends RowDataPacket {
  id: string;
  user_id: string;
  name: string;
  status: string;
  nodes_json: string | unknown;
  edges_json: string | unknown;
  last_run_at: number | null;
  created_at: number;
  updated_at: number;
}

export interface WorkflowListItem {
  id: string;
  name: string;
  status: WorkflowStatus;
  nodeCount: number;
  lastRunAt: number | null;
  updatedAt: number;
}

export interface WorkflowDetail {
  id: string;
  userId: string;
  name: string;
  status: WorkflowStatus;
  nodes: unknown[];
  edges: unknown[];
  lastRunAt: number | null;
  createdAt: number;
  updatedAt: number;
}

export interface WorkflowListOptions {
  limit?: number;
  offset?: number;
  search?: string;
  status?: WorkflowStatus | "all";
}

export interface CreateWorkflowInput {
  id?: string;
  userId: string;
  name: string;
  status?: WorkflowStatus;
  nodes: unknown[];
  edges: unknown[];
  lastRunAt?: number | null;
}

export interface UpdateWorkflowInput {
  name?: string;
  status?: WorkflowStatus;
  nodes?: unknown[];
  edges?: unknown[];
  lastRunAt?: number | null;
}

function isWorkflowStatus(value: unknown): value is WorkflowStatus {
  return value === "idle" || value === "running" || value === "failed";
}

function normalizeName(name: unknown): string {
  if (typeof name !== "string") {
    throw new Error("name 必须是字符串");
  }
  const trimmed = name.trim();
  if (trimmed.length < 1 || trimmed.length > 128) {
    throw new Error("name 长度必须在 1 到 128 个字符之间");
  }
  return trimmed;
}

function ensureArray(value: unknown, fieldName: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${fieldName} 必须是数组`);
  }
  return value;
}

function parseJsonArray(value: unknown, fieldName: string): unknown[] {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = JSON.parse(value) as unknown;
    if (Array.isArray(parsed)) {
      return parsed;
    }
  }
  throw new Error(`${fieldName} 不是有效的数组 JSON`);
}

function serializeJsonArray(value: unknown, fieldName: string): string {
  return JSON.stringify(ensureArray(value, fieldName));
}

function workflowRowToDetail(row: WorkflowRow): WorkflowDetail {
  const status = isWorkflowStatus(row.status) ? row.status : "idle";
  return {
    id: row.id,
    userId: row.user_id,
    name: row.name,
    status,
    nodes: parseJsonArray(row.nodes_json, "nodes_json"),
    edges: parseJsonArray(row.edges_json, "edges_json"),
    lastRunAt: row.last_run_at ?? null,
    createdAt: Number(row.created_at),
    updatedAt: Number(row.updated_at),
  };
}

function workflowDetailToListItem(workflow: WorkflowDetail): WorkflowListItem {
  return {
    id: workflow.id,
    name: workflow.name,
    status: workflow.status,
    nodeCount: workflow.nodes.length,
    lastRunAt: workflow.lastRunAt,
    updatedAt: workflow.updatedAt,
  };
}

function buildWorkflowFilter(userId: string, options?: WorkflowListOptions): {
  whereSql: string;
  params: unknown[];
} {
  const clauses = ["user_id = ?"];
  const params: unknown[] = [userId];
  const search = options?.search?.trim();

  if (search) {
    clauses.push("name LIKE ?");
    params.push(`%${search}%`);
  }

  if (options?.status && options.status !== "all") {
    clauses.push("status = ?");
    params.push(options.status);
  }

  return {
    whereSql: clauses.join(" AND "),
    params,
  };
}

export async function listByUserId(
  userId: string,
  options?: WorkflowListOptions
): Promise<{ items: WorkflowListItem[]; total: number }> {
  const limit = Math.min(100, Math.max(1, options?.limit ?? 20));
  const offset = Math.max(0, options?.offset ?? 0);
  const filter = buildWorkflowFilter(userId, options);

  const [countRows] = await db.query<RowDataPacket[]>(
    `SELECT COUNT(*) AS total FROM workflows WHERE ${filter.whereSql}`,
    filter.params
  );
  const total = Number((countRows?.[0] as { total?: number })?.total ?? 0);

  const [rows] = await db.query<WorkflowRow[]>(
    `SELECT *
       FROM workflows
      WHERE ${filter.whereSql}
      ORDER BY updated_at DESC
      LIMIT ? OFFSET ?`,
    [...filter.params, limit, offset]
  );

  const items = (rows ?? []).map((row) =>
    workflowDetailToListItem(workflowRowToDetail(row))
  );
  return { items, total };
}

export async function findById(
  id: string,
  userId: string
): Promise<WorkflowDetail | null> {
  const [rows] = await db.query<WorkflowRow[]>(
    "SELECT * FROM workflows WHERE id = ? AND user_id = ? LIMIT 1",
    [id, userId]
  );
  const row = rows?.[0];
  return row ? workflowRowToDetail(row) : null;
}

export async function createWorkflow(
  input: CreateWorkflowInput
): Promise<WorkflowDetail> {
  const id = input.id ?? `wf_${randomUUID().replace(/-/g, "")}`;
  const name = normalizeName(input.name);
  const status: WorkflowStatus = input.status ?? "idle";
  if (!isWorkflowStatus(status)) {
    throw new Error("status 无效");
  }
  const nodes = ensureArray(input.nodes, "nodes");
  const edges = ensureArray(input.edges, "edges");
  const now = Date.now();
  const createdAt = now;
  const updatedAt = now;
  const lastRunAt = input.lastRunAt ?? null;

  await db.query(
    `INSERT INTO workflows
      (id, user_id, name, status, nodes_json, edges_json, last_run_at, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      input.userId,
      name,
      status,
      JSON.stringify(nodes),
      JSON.stringify(edges),
      lastRunAt,
      createdAt,
      updatedAt,
    ]
  );

  const workflow = await findById(id, input.userId);
  if (!workflow) {
    throw new Error("创建工作流失败");
  }
  return workflow;
}

export async function updateWorkflow(
  id: string,
  userId: string,
  updates: UpdateWorkflowInput
): Promise<WorkflowDetail | null> {
  const sets: string[] = [];
  const params: unknown[] = [];

  if (updates.name !== undefined) {
    sets.push("name = ?");
    params.push(normalizeName(updates.name));
  }
  if (updates.status !== undefined) {
    if (!isWorkflowStatus(updates.status)) {
      throw new Error("status 无效");
    }
    sets.push("status = ?");
    params.push(updates.status);
  }
  if (updates.nodes !== undefined) {
    sets.push("nodes_json = ?");
    params.push(serializeJsonArray(updates.nodes, "nodes"));
  }
  if (updates.edges !== undefined) {
    sets.push("edges_json = ?");
    params.push(serializeJsonArray(updates.edges, "edges"));
  }
  if (updates.lastRunAt !== undefined) {
    sets.push("last_run_at = ?");
    params.push(updates.lastRunAt);
  }

  if (sets.length === 0) {
    return findById(id, userId);
  }

  const updatedAt = Date.now();
  sets.push("updated_at = ?");
  params.push(updatedAt, id, userId);

  const [result] = await db.query(
    `UPDATE workflows SET ${sets.join(", ")} WHERE id = ? AND user_id = ?`,
    params
  );
  const affected = (result as ResultSetHeader)?.affectedRows ?? 0;
  if (affected === 0) {
    return null;
  }

  return findById(id, userId);
}

export async function deleteWorkflow(
  id: string,
  userId: string
): Promise<boolean> {
  const [result] = await db.query(
    "DELETE FROM workflows WHERE id = ? AND user_id = ?",
    [id, userId]
  );
  const affected = (result as ResultSetHeader)?.affectedRows ?? 0;
  return affected > 0;
}
