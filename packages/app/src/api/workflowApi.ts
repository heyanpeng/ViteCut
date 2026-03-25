import type { WorkflowComposerProps } from "@vitecut/workflow";
import { getAuthHeaders } from "@/contexts";

export type WorkflowRunStatus = "running" | "idle" | "failed";

export interface WorkflowListItem {
  id: string;
  name: string;
  status: WorkflowRunStatus;
  nodeCount: number;
  lastRun: string;
}

type WorkflowSavePayload = Parameters<NonNullable<WorkflowComposerProps["onSave"]>>[0];

export interface WorkflowDetail {
  id: string;
  name: string;
  status: WorkflowRunStatus;
  nodes: WorkflowSavePayload["nodes"];
  edges: WorkflowSavePayload["edges"];
  lastRunAt: number | null;
}

export interface WorkflowUpsertPayload {
  name: string;
  nodes: WorkflowSavePayload["nodes"];
  edges: WorkflowSavePayload["edges"];
}

export interface GetWorkflowListParams {
  search?: string;
  status?: "all" | WorkflowRunStatus;
  page?: number;
  limit?: number;
}

interface WorkflowListResponseItem {
  id: string;
  name: string;
  status: WorkflowRunStatus;
  nodeCount: number;
  lastRunAt: number | null;
}

interface WorkflowListResponse {
  items: WorkflowListResponseItem[];
  total: number;
}

interface WorkflowDetailResponse {
  id: string;
  name: string;
  status: WorkflowRunStatus;
  nodes: WorkflowSavePayload["nodes"];
  edges: WorkflowSavePayload["edges"];
  lastRunAt: number | null;
}

function formatLastRun(lastRunAt: number | null): string {
  if (!lastRunAt) return "未执行";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(lastRunAt));
}

async function parseJson<T>(response: Response): Promise<T | { error?: string }> {
  return response.json().catch(() => ({}));
}

async function assertOk<T>(response: Response, fallbackMessage: string): Promise<T> {
  const data = await parseJson<T>(response);
  if (!response.ok) {
    throw new Error(
      (data as { error?: string }).error ?? `${fallbackMessage}: ${response.status}`
    );
  }
  return data as T;
}

function toListItem(item: WorkflowListResponseItem): WorkflowListItem {
  return {
    id: item.id,
    name: item.name,
    status: item.status,
    nodeCount: item.nodeCount,
    lastRun: formatLastRun(item.lastRunAt),
  };
}

export async function getWorkflowList(
  params: GetWorkflowListParams = {}
): Promise<WorkflowListItem[]> {
  const query = new URLSearchParams();
  query.set("page", String(params.page ?? 1));
  query.set("limit", String(params.limit ?? 50));
  if (params.search?.trim()) {
    query.set("search", params.search.trim());
  }
  if (params.status && params.status !== "all") {
    query.set("status", params.status);
  }

  const response = await fetch(`/api/workflows?${query.toString()}`, {
    headers: getAuthHeaders(),
  });
  const data = await assertOk<WorkflowListResponse>(response, "获取工作流列表失败");
  return data.items.map(toListItem);
}

export async function getWorkflow(id: string): Promise<WorkflowDetail> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    headers: getAuthHeaders(),
  });
  const data = await assertOk<WorkflowDetailResponse>(response, "获取工作流详情失败");
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    nodes: data.nodes,
    edges: data.edges,
    lastRunAt: data.lastRunAt,
  };
}

export async function createWorkflow(
  payload: WorkflowUpsertPayload
): Promise<WorkflowDetail> {
  const response = await fetch("/api/workflows", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await assertOk<WorkflowDetailResponse>(response, "创建工作流失败");
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    nodes: data.nodes,
    edges: data.edges,
    lastRunAt: data.lastRunAt,
  };
}

export async function updateWorkflow(
  id: string,
  payload: WorkflowUpsertPayload
): Promise<WorkflowDetail> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json", ...getAuthHeaders() },
    body: JSON.stringify(payload),
  });
  const data = await assertOk<WorkflowDetailResponse>(response, "更新工作流失败");
  return {
    id: data.id,
    name: data.name,
    status: data.status,
    nodes: data.nodes,
    edges: data.edges,
    lastRunAt: data.lastRunAt,
  };
}

export async function deleteWorkflow(id: string): Promise<void> {
  const response = await fetch(`/api/workflows/${encodeURIComponent(id)}`, {
    method: "DELETE",
    headers: getAuthHeaders(),
  });
  await assertOk<{ ok: true }>(response, "删除工作流失败");
}
