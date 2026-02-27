import "./loadEnv.js";
import path from "node:path";
import fs from "node:fs";
import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import fastifyMultipart from "@fastify/multipart";
import cors from "@fastify/cors";
import { initDb } from "./lib/db.js";
import { healthRoutes } from "./routes/health.js";
import { mediaRoutes } from "./routes/media.js";
import { renderRoutes } from "./routes/render.js";

// 输出目录（用于存放渲染结果等）
const OUTPUT_DIR = path.join(process.cwd(), "output");
// 上传目录（用于存放用户上传的媒体素材）
const UPLOADS_DIR = path.join(process.cwd(), "uploads");
// 服务器端口，默认 3001，可通过环境变量 PORT 指定
const PORT = Number(process.env.PORT) || 3001;

// 确保输出目录和上传目录存在（如不存在会自动创建）
fs.mkdirSync(OUTPUT_DIR, { recursive: true });
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

// 创建 Fastify 实例，并启用日志记录
const fastify = Fastify({ logger: true });

// 注册 CORS 插件，允许所有来源访问
await fastify.register(cors, { origin: true });

// 注册 multipart 插件，支持文件上传，并限制最大文件大小为 500MB
await fastify.register(fastifyMultipart, {
  limits: { fileSize: 500 * 1024 * 1024 }, // 500MB
});

// 先注册 @fastify/static 以获取 sendFile（output 会用到）
await fastify.register(fastifyStatic, {
  root: OUTPUT_DIR,
  prefix: "/output/",
});

// 显式处理 GET /uploads/*，在 Docker 等环境下确保能正确匹配并返回文件
fastify.get("/uploads/*", async (request, reply) => {
  const pathname = (request.url ?? "").split("?")[0];
  const raw = (request.params as { "*"?: string })["*"] ?? pathname.replace(/^\/uploads\/?/, "");
  const rel = (raw.startsWith("/") ? raw.slice(1) : raw).replace(/^\/+/, "");
  if (!rel || rel.includes("..") || path.isAbsolute(rel)) {
    return reply.status(400).send({ error: "非法路径" });
  }
  const filePath = path.join(UPLOADS_DIR, rel);
  const resolved = path.resolve(filePath);
  const uploadsResolved = path.resolve(UPLOADS_DIR);
  if (!resolved.startsWith(uploadsResolved)) {
    return reply.status(403).send({ error: "禁止访问" });
  }
  try {
    const stat = fs.statSync(filePath);
    if (!stat.isFile()) {
      return reply.status(404).send({ error: "文件不存在" });
    }
    return reply.sendFile(rel, UPLOADS_DIR);
  } catch {
    return reply.status(404).send({ error: "文件不存在" });
  }
});

// 初始化 MySQL 并创建表
await initDb();

// 注册健康检查路由
await fastify.register(healthRoutes);
// 注册媒体相关路由，并传递 uploadsDir 和 port 配置
await fastify.register(mediaRoutes, { uploadsDir: UPLOADS_DIR, port: PORT });
// 注册渲染相关路由
await fastify.register(renderRoutes);

try {
  // 启动服务器，监听指定端口
  await fastify.listen({ port: PORT, host: "0.0.0.0" });
} catch (err) {
  // 启动失败时记录错误并退出进程
  fastify.log.error(err);
  process.exit(1);
}
