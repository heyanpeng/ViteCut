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

// 服务器端口配置，默认 3001。可通过环境变量 PORT 覆盖
const PORT = Number(process.env.PORT) || 3001;

// 创建对象存储适配器（本地/云端自动切换），供媒体、渲染、AI 路由使用
const storage = createStorageAdapterFromEnv();

// 创建 Fastify 服务实例，开启日志记录功能
const fastify = Fastify({ logger: true });

// 注册 CORS 跨域资源共享插件，允许任意前端发起请求
await fastify.register(cors, { origin: true });

// 初始化数据库并自动建表（如未初始化）
await initDb();
// 检查用户表，无账号自动创建默认管理员（用户名/密码可自定义 via 环境变量）
await ensureDefaultUser();

// 注册各 API 路由模块（分层组织，便于维护与扩展）
await fastify.register(healthRoutes); // 健康检查，便于监控与存活探测
await fastify.register(authRoutes); // 用户注册、登录、认证
await fastify.register(taskRoutes); // 任务管理相关 API
await fastify.register(mediaRoutes, { storage }); // 媒体上传/下载，注入存储适配器
await fastify.register(renderRoutes, { storage }); // 渲染、视频处理服务
await fastify.register(aiRoutes, { storage }); // AI 生成图片等 API，含存储

try {
  // 启动服务，监听在所有 IPv4 网卡上的指定端口（默认 3001）
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  // 启动异常时写日志并退出进程（服务保障/容器自动重启）
  fastify.log.error(err);
  process.exit(1);
}
