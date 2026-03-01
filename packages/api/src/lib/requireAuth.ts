import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./jwt.js";

// 认证用户信息接口，附加在 request 上
export interface AuthUser {
  userId: string;
  username: string;
}

/**
 * Fastify 中间件：验证请求是否已登录（Bearer Token）
 * 验证通过后在 request.user 注入用户信息，否则 401
 */
export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
): void {
  // 读取 Authorization header 并提取 Bearer token
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : null;

  // 未提供 token 情况，返回未登录
  if (!token) {
    reply.status(401).send({ error: "未登录或登录已过期" });
    done();
    return;
  }

  // 验证 token
  const payload = verifyToken(token);
  if (!payload) {
    reply.status(401).send({ error: "未登录或登录已过期" });
    done();
    return;
  }

  // 验证通过，写入 request.user
  (request as FastifyRequest & { user?: AuthUser }).user = {
    userId: payload.userId,
    username: payload.username,
  };
  done();
}
