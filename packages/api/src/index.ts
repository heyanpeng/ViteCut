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

// 注册静态文件服务 /output/ 路径，用于访问渲染输出文件
await fastify.register(fastifyStatic, {
  root: OUTPUT_DIR,
  prefix: "/output/",
});

// 注册静态文件服务 /uploads/ 路径，用于访问上传文件
await fastify.register(fastifyStatic, {
  root: UPLOADS_DIR,
  prefix: "/uploads/",
  decorateReply: false, // 避免 sendFile 装饰器冲突
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
