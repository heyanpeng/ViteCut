import type { FastifyInstance } from "fastify";
import { createUser, findByUsername, hashPassword, verifyPassword } from "../lib/auth.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../lib/requireAuth.js";

const USERNAME_MIN = 2;
const USERNAME_MAX = 64;
const PASSWORD_MIN = 6;

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post<{
    Body: { username?: string; password?: string };
  }>("/api/auth/register", async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    if (!username || username.length < USERNAME_MIN || username.length > USERNAME_MAX) {
      return reply.status(400).send({
        error: `用户名长度为 ${USERNAME_MIN}-${USERNAME_MAX} 个字符`,
      });
    }
    if (!password || typeof password !== "string" || password.length < PASSWORD_MIN) {
      return reply.status(400).send({
        error: `密码至少 ${PASSWORD_MIN} 个字符`,
      });
    }

    const existing = await findByUsername(username);
    if (existing) {
      return reply.status(409).send({ error: "用户名已被使用" });
    }

    const passwordHash = await hashPassword(password);
    const user = await createUser(username, passwordHash);

    const token = signToken({ userId: user.id, username: user.username });
    return {
      token,
      user: { id: user.id, username: user.username },
    };
  });

  fastify.post<{
    Body: { username?: string; password?: string };
  }>("/api/auth/login", async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    if (!username || !password) {
      return reply.status(400).send({ error: "请输入用户名和密码" });
    }
    if (typeof password !== "string" || password.length < PASSWORD_MIN) {
      return reply.status(400).send({
        error: `密码至少 ${PASSWORD_MIN} 个字符`,
      });
    }

    const user = await findByUsername(username);
    if (!user) {
      return reply.status(401).send({ error: "用户名或密码错误" });
    }

    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: "用户名或密码错误" });
    }

    const token = signToken({ userId: user.id, username: user.username });
    return {
      token,
      user: { id: user.id, username: user.username },
    };
  });

  fastify.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = (request as { user?: { userId: string; username: string } }).user;
    return { user };
  });
}
