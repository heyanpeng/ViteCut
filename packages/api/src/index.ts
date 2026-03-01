import "./loadEnv.js";
import Fastify from "fastify";
import cors from "@fastify/cors";
import { initDb } from "./lib/db.js";
import { ensureDefaultUser } from "./lib/auth.js";
import { healthRoutes } from "./routes/health.js";
import { authRoutes } from "./routes/auth.js";
import { taskRoutes } from "./routes/tasks.js";
import { mediaRoutes } from "./routes/media.js";
import { renderRoutes } from "./routes/render.js";
import { aiRoutes } from "./routes/ai.js";
import { createStorageAdapterFromEnv } from "@vitecut/storage";

// 服务器端口，默认 3001，可通过环境变量 PORT 指定
const PORT = Number(process.env.PORT) || 3001;

const storage = createStorageAdapterFromEnv();

// 创建 Fastify 实例，并启用日志记录
const fastify = Fastify({ logger: true });

// 注册 CORS 插件，允许所有来源访问
await fastify.register(cors, { origin: true });

// 初始化 MySQL 并创建表
await initDb();
// 若无任何用户则创建默认账号（demo / 123456，可通过 DEFAULT_ADMIN_USERNAME、DEFAULT_ADMIN_PASSWORD 覆盖）
await ensureDefaultUser();

// 注册健康检查路由
await fastify.register(healthRoutes);
// 注册认证路由（注册、登录、当前用户）
await fastify.register(authRoutes);
// 注册任务相关路由
await fastify.register(taskRoutes);
// 注册媒体相关路由
await fastify.register(mediaRoutes, { storage, port: PORT });
// 注册渲染相关路由
await fastify.register(renderRoutes, { storage });
// 注册 AI 图片生成路由（火山方舟 Seedream）
await fastify.register(aiRoutes, { storage, port: PORT });

try {
  // 启动服务器，监听指定端口
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  // 启动失败时记录错误并退出进程
  fastify.log.error(err);
  process.exit(1);
}
