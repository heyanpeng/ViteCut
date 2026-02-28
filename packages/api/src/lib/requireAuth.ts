import type { FastifyRequest, FastifyReply } from "fastify";
import { verifyToken } from "./jwt.js";

export interface AuthUser {
  userId: string;
  username: string;
}

export function requireAuth(
  request: FastifyRequest,
  reply: FastifyReply,
  done: (err?: Error) => void
): void {
  const header = request.headers.authorization;
  const token =
    header?.startsWith("Bearer ") ? header.slice(7) : null;

  if (!token) {
    reply.status(401).send({ error: "未登录或登录已过期" });
    done();
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    reply.status(401).send({ error: "未登录或登录已过期" });
    done();
    return;
  }

  (request as FastifyRequest & { user?: AuthUser }).user = {
    userId: payload.userId,
    username: payload.username,
  };
  done();
}
