import type { FastifyInstance } from "fastify";
import {
  createUser,
  findByUsername,
  hashPassword,
  verifyPassword,
} from "../lib/auth.js";
import { signToken } from "../lib/jwt.js";
import { requireAuth } from "../lib/requireAuth.js";

// 用户名和密码的最小/最大长度常量
const USERNAME_MIN = 2;
const USERNAME_MAX = 64;
const PASSWORD_MIN = 6;

/**
 * 注册认证相关路由
 * @param fastify Fastify 实例
 */
export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  /**
   * 用户注册接口
   * - 校验用户名和密码
   * - 检查用户名是否被占用
   * - 创建新用户并返回 token
   */
  fastify.post<{
    Body: { username?: string; password?: string };
  }>("/api/auth/register", async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    // 校验用户名长度
    if (
      !username ||
      username.length < USERNAME_MIN ||
      username.length > USERNAME_MAX
    ) {
      return reply.status(400).send({
        error: `用户名长度为 ${USERNAME_MIN}-${USERNAME_MAX} 个字符`,
      });
    }
    // 校验密码有效性和长度
    if (
      !password ||
      typeof password !== "string" ||
      password.length < PASSWORD_MIN
    ) {
      return reply.status(400).send({
        error: `密码至少 ${PASSWORD_MIN} 个字符`,
      });
    }

    // 检查用户名是否已存在
    const existing = await findByUsername(username);
    if (existing) {
      return reply.status(409).send({ error: "用户名已被使用" });
    }

    // 对密码进行哈希，并创建新用户
    const passwordHash = await hashPassword(password);
    const user = await createUser(username, passwordHash);

    // 签发登录 token
    const token = signToken({ userId: user.id, username: user.username });
    return {
      token,
      user: { id: user.id, username: user.username },
    };
  });

  /**
   * 用户登录接口
   * - 校验用户名和密码
   * - 检查用户名是否存在
   * - 验证密码正确性
   * - 返回 token
   */
  fastify.post<{
    Body: { username?: string; password?: string };
  }>("/api/auth/login", async (request, reply) => {
    const username = request.body?.username?.trim();
    const password = request.body?.password;

    // 校验参数
    if (!username || !password) {
      return reply.status(400).send({ error: "请输入用户名和密码" });
    }
    // 校验密码合法性
    if (typeof password !== "string" || password.length < PASSWORD_MIN) {
      return reply.status(400).send({
        error: `密码至少 ${PASSWORD_MIN} 个字符`,
      });
    }

    // 查找用户
    const user = await findByUsername(username);
    if (!user) {
      return reply.status(401).send({ error: "用户名或密码错误" });
    }

    // 验证密码
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      return reply.status(401).send({ error: "用户名或密码错误" });
    }

    // 返回登录后的 token 和用户信息
    const token = signToken({ userId: user.id, username: user.username });
    return {
      token,
      user: { id: user.id, username: user.username },
    };
  });

  /**
   * 获取当前用户信息接口
   * 需先通过 requireAuth 鉴权
   */
  fastify.get("/api/auth/me", { preHandler: requireAuth }, async (request) => {
    const user = (request as { user?: { userId: string; username: string } })
      .user;
    return { user };
  });
}
