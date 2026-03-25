import type { FastifyInstance } from "fastify";
import {
  createWorkflow,
  deleteWorkflow,
  findById,
  listByUserId,
  normalizeWorkflowLastRunAt,
  updateWorkflow,
  type WorkflowStatus,
} from "../lib/workflowRepository.js";
import { requireAuth } from "../lib/requireAuth.js";

type WorkflowListQuery = {
  page?: string;
  limit?: string;
  search?: string;
  status?: "all" | WorkflowStatus;
};

type WorkflowBody = Record<string, unknown>;

const WORKFLOW_STATUSES: WorkflowStatus[] = ["idle", "running", "failed"];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parsePageAndLimit(query: WorkflowListQuery): {
  page: number;
  limit: number;
  offset: number;
} | null {
  const rawPage = query.page ?? "1";
  const rawLimit = query.limit ?? "20";
  const page = Number(rawPage);
  const limit = Number(rawLimit);
  if (
    !Number.isInteger(page) ||
    !Number.isInteger(limit) ||
    page < 1 ||
    limit < 1 ||
    limit > 100
  ) {
    return null;
  }
  return {
    page,
    limit,
    offset: (page - 1) * limit,
  };
}

function parseWorkflowStatus(
  value: unknown
): WorkflowStatus | "all" | null {
  if (value === undefined || value === "all") {
    return "all";
  }
  if (typeof value === "string" && WORKFLOW_STATUSES.includes(value as WorkflowStatus)) {
    return value as WorkflowStatus;
  }
  return null;
}

function parseWorkflowBody(
  body: unknown,
  mode: "create" | "update"
):
  | {
      name?: string;
      status?: WorkflowStatus;
      nodes?: unknown[];
      edges?: unknown[];
      lastRunAt?: number | null;
    }
  | null {
  if (!isRecord(body)) {
    return null;
  }

  const payload: {
    name?: string;
    status?: WorkflowStatus;
    nodes?: unknown[];
    edges?: unknown[];
    lastRunAt?: number | null;
  } = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return null;
    }
    const name = body.name.trim();
    if (name.length < 1 || name.length > 128) {
      return null;
    }
    payload.name = name;
  } else if (mode === "create") {
    return null;
  }

  if (body.status !== undefined) {
    if (
      typeof body.status !== "string" ||
      !WORKFLOW_STATUSES.includes(body.status as WorkflowStatus)
    ) {
      return null;
    }
    payload.status = body.status as WorkflowStatus;
  }

  if (body.nodes !== undefined) {
    if (!Array.isArray(body.nodes)) {
      return null;
    }
    payload.nodes = body.nodes;
  } else if (mode === "create") {
    return null;
  }

  if (body.edges !== undefined) {
    if (!Array.isArray(body.edges)) {
      return null;
    }
    payload.edges = body.edges;
  } else if (mode === "create") {
    return null;
  }

  if (body.lastRunAt !== undefined) {
    try {
      payload.lastRunAt = normalizeWorkflowLastRunAt(body.lastRunAt);
    } catch {
      return null;
    }
  }

  if (mode === "update" && Object.keys(payload).length === 0) {
    return null;
  }

  return payload;
}

function getUserId(request: unknown): string | null {
  const userId = (request as { user?: { userId?: unknown } }).user?.userId;
  return typeof userId === "string" && userId.trim() ? userId : null;
}

export async function workflowRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.get<{
    Querystring: WorkflowListQuery;
  }>("/api/workflows", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const paging = parsePageAndLimit(request.query);
    if (!paging) {
      return reply.status(400).send({ error: "page 或 limit 参数无效" });
    }

    const status = parseWorkflowStatus(request.query.status);
    if (status === null) {
      return reply.status(400).send({ error: "status 参数无效" });
    }

    try {
      const result = await listByUserId(userId, {
        limit: paging.limit,
        offset: paging.offset,
        search: request.query.search,
        status,
      });
      return result;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "服务器内部错误" });
    }
  });

  fastify.get<{ Params: { id: string } }>(
    "/api/workflows/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }

      try {
        const workflow = await findById(request.params.id, userId);
        if (!workflow) {
          return reply.status(404).send({ error: "工作流不存在" });
        }
        return workflow;
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "服务器内部错误" });
      }
    }
  );

  fastify.post<{
    Body: WorkflowBody;
  }>("/api/workflows", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const payload = parseWorkflowBody(request.body, "create");
    if (!payload || !payload.name || !payload.nodes || !payload.edges) {
      return reply.status(400).send({ error: "请求体无效" });
    }

    try {
      const workflow = await createWorkflow({
        userId,
        name: payload.name,
        status: payload.status,
        nodes: payload.nodes,
        edges: payload.edges,
        lastRunAt: payload.lastRunAt,
      });
      return workflow;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "服务器内部错误" });
    }
  });

  fastify.put<{
    Params: { id: string };
    Body: WorkflowBody;
  }>("/api/workflows/:id", { preHandler: requireAuth }, async (request, reply) => {
    const userId = getUserId(request);
    if (!userId) {
      return reply.status(401).send({ error: "未登录" });
    }

    const payload = parseWorkflowBody(request.body, "update");
    if (!payload) {
      return reply.status(400).send({ error: "请求体无效" });
    }

    try {
      const workflow = await updateWorkflow(request.params.id, userId, payload);
      if (!workflow) {
        return reply.status(404).send({ error: "工作流不存在" });
      }
      return workflow;
    } catch (error) {
      request.log.error(error);
      return reply.status(500).send({ error: "服务器内部错误" });
    }
  });

  fastify.delete<{ Params: { id: string } }>(
    "/api/workflows/:id",
    { preHandler: requireAuth },
    async (request, reply) => {
      const userId = getUserId(request);
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }

      try {
        const ok = await deleteWorkflow(request.params.id, userId);
        if (!ok) {
          return reply.status(404).send({ error: "工作流不存在" });
        }
        return { ok: true };
      } catch (error) {
        request.log.error(error);
        return reply.status(500).send({ error: "服务器内部错误" });
      }
    }
  );
}
