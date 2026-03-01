/**
 * 火山方舟 Seedream 图片生成 API 接入
 * 文档：https://www.volcengine.com/docs/82379/1541523
 *
 * 使用前需在火山方舟控制台创建推理接入点，获取 Endpoint ID，
 * 并配置对应的环境变量（如 ARK_ENDPOINT_DOUBAO_SEEDREAM_5_0_LITE）。
 *
 * 生成成功后由后端下载图片到 uploads，再入库到媒体库（避免临时 URL 过期）。
 */
import path from "node:path";
import fs from "node:fs";
import { randomUUID } from "node:crypto";
import type { FastifyInstance } from "fastify";
import { addRecord } from "../lib/mediaLibrary.js";
import { requireAuth } from "../lib/requireAuth.js";
import { getBaseUrl } from "../utils/baseUrl.js";
import { findById, update } from "../lib/taskRepository.js";
import { broadcastTaskUpdate } from "../lib/taskEvents.js";

/**
 * 给资源的相对 url 或 coverUrl 补齐成绝对地址
 */
function withAbsoluteUrl<T extends { url?: string; coverUrl?: string }>(
  record: T,
  baseUrl: string
): T {
  const base = baseUrl.replace(/\/$/, "");
  const result = { ...record };
  const u = (result as { url?: string }).url ?? "";
  if (u && !u.startsWith("http://") && !u.startsWith("https://")) {
    (result as { url: string }).url =
      `${base}${u.startsWith("/") ? u : `/${u}`}`;
  }
  const c = (result as { coverUrl?: string }).coverUrl ?? "";
  if (c && !c.startsWith("http://") && !c.startsWith("https://")) {
    (result as { coverUrl: string }).coverUrl =
      `${base}${c.startsWith("/") ? c : `/${c}`}`;
  }
  return result;
}

/**
 * 路由参数选项，uploadsDir 指定上传路径，port 为后端端口
 */
export interface AiRoutesOptions {
  uploadsDir: string;
  port: number;
}

// ark 平台基础配置
const ARK_BASE_URL =
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_IMAGE_PATH = "/images/generations";
const ARK_CHAT_PATH = "/chat/completions";

/** 前端 model id -> 环境变量名 （每个模型对应 Ark endpoint） */
const MODEL_ENV_KEYS: Record<string, string> = {
  "doubao-seedream-5.0-lite": "ARK_ENDPOINT_DOUBAO_SEEDREAM_5_0_LITE",
  "doubao-seedream-4.5": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_5",
  "doubao-seedream-4.0": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_0",
  "doubao-seedream-3.0-t2i": "ARK_ENDPOINT_DOUBAO_SEEDREAM_3_0_T2I",
  "doubao-seed-1.8": "ARK_ENDPOINT_SEED_1_8",
};

/** doubao-seed-1.8 增强模型的 endpoint 环境变量名 */
const SEED_ENHANCE_ENDPOINT_ENV_KEY = MODEL_ENV_KEYS["doubao-seed-1.8"];
/** 获取 doubao-seed-1.8 增强模型的实际 endpoint */
const SEED_ENHANCE_ENDPOINT = process.env[SEED_ENHANCE_ENDPOINT_ENV_KEY];

/**
 * 前端 aspect_ratio + resolution -> 火山方舟 size
 * size 支持 "2K"、"4K" 或 "宽x高" 格式，用于生成图片尺寸
 * 参考：https://shihuo.mintlify.app/api-reference/image-generation
 */
const ASPECT_2K: Record<string, string> = {
  smart: "2K",
  "1:1": "2048x2048",
  "16:9": "2560x1440",
  "9:16": "1440x2560",
  "4:3": "2304x1728",
  "3:4": "1728x2304",
  "3:2": "2496x1664",
  "2:3": "1664x2496",
  "21:9": "3024x1296",
};
const ASPECT_4K: Record<string, string> = {
  smart: "4K",
  "1:1": "4096x4096",
  "16:9": "5120x2880",
  "9:16": "2880x5120",
  "4:3": "4608x3456",
  "3:4": "3456x4608",
  "3:2": "4992x3328",
  "2:3": "3328x4992",
  "21:9": "6048x2592",
};

/** doubao-seedream-3.0-t2i 仅支持 "宽x高" 格式（如 1024x1024），不支持 2K/4K */
const SIZE_3_0_T2I: Record<string, string> = {
  smart: "1024x1024",
  "1:1": "1024x1024",
  "16:9": "1024x576",
  "9:16": "576x1024",
  "4:3": "1024x768",
  "3:4": "768x1024",
  "3:2": "1024x682",
  "2:3": "682x1024",
  "21:9": "1024x438",
};

/**
 * /api/ai/image POST 请求 body
 */
interface AiImageRequest {
  prompt: string; // 提示词
  aspectRatio?: string; // 长宽比
  resolution?: string; // "2k" | "4k"
  model?: string; // 模型 id
  referenceImages?: string[]; // 参考图
  /** 必填：关联的后端任务 id，生成过程中会更新任务状态并通过 SSE 推送 */
  taskId: string;
}

/**
 * 火山返回的图片生成响应格式
 */
interface ArkImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { code?: string; message?: string };
}

/**
 * 支持的提示词增强类型
 */
type PromptEnhanceType =
  | "proofread"
  | "polish"
  | "expand"
  | "abbreviate"
  | "more-fun"
  | "more-pro";

/**
 * /api/ai/prompt-enhance POST body
 */
interface PromptEnhanceRequest {
  prompt: string;
  type: PromptEnhanceType; // 增强类型
  creationType: "image" | "video"; // 创作类型
}

/**
 * Ark 聊天接口响应格式（内容嵌套结构）
 */
interface ArkChatResponse {
  choices?: Array<{
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
          }>;
    };
  }>;
  error?: { code?: string; message?: string };
}

/**
 * 构建系统 prompt，教火山 AI 如何处理增强
 */
function buildEnhanceSystemPrompt(
  type: PromptEnhanceType,
  creationType: "image" | "video"
): string {
  const target = creationType === "video" ? "视频生成" : "图片生成";
  const actionMap: Record<PromptEnhanceType, string> = {
    proofread: "校对语法与错别字，保持原意",
    polish: "润色表达，提高可读性和专业性",
    expand: "在保留原意下扩写细节，让描述更完整",
    abbreviate: "在保留关键信息下精简表达",
    "more-fun": "让风格更有趣、更生动",
    "more-pro": "让风格更专业、更商业化",
  };
  const maxLen = creationType === "video" ? 500 : 200;
  return [
    `你是${target}提示词优化助手。`,
    `任务：${actionMap[type]}。`,
    "仅返回优化后的最终中文提示词，不要解释、不要加引号、不要分点。",
    `严格控制长度不超过 ${maxLen} 个字符。`,
  ].join("");
}

/**
 * 提取 chat/completions 的有效内容
 */
function extractArkContent(data: ArkChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    return content
      .map((item) => (item?.type === "text" ? (item.text ?? "") : ""))
      .join("")
      .trim();
  }
  return "";
}

/**
 * fastify 路由注入入口
 */
export async function aiRoutes(
  fastify: FastifyInstance,
  opts: AiRoutesOptions
): Promise<void> {
  const { uploadsDir, port } = opts;
  const arkKey = process.env.ARK_API_KEY;
  if (!arkKey) {
    fastify.log.warn("[ai] ARK_API_KEY 未配置，火山方舟图片生成接口将不可用");
  }
  if (!SEED_ENHANCE_ENDPOINT) {
    fastify.log.warn(
      `[ai] ${SEED_ENHANCE_ENDPOINT_ENV_KEY} 未配置，AI 提示词优化接口将不可用`
    );
  }

  /**
   * AI 提示词增强路由
   */
  fastify.post<{ Body: PromptEnhanceRequest }>(
    "/api/ai/prompt-enhance",
    { preHandler: requireAuth },
    async (request, reply) => {
      if (!arkKey) {
        return reply.status(503).send({
          error: "AI 服务未配置，请在环境变量中设置 ARK_API_KEY",
        });
      }
      if (!SEED_ENHANCE_ENDPOINT) {
        return reply.status(503).send({
          error: `AI 优化服务未配置，请在环境变量中设置 ${SEED_ENHANCE_ENDPOINT_ENV_KEY}`,
        });
      }
      // 参数校验
      const { prompt, type, creationType } = request.body || {};
      const validTypes: PromptEnhanceType[] = [
        "proofread",
        "polish",
        "expand",
        "abbreviate",
        "more-fun",
        "more-pro",
      ];
      if (!prompt || typeof prompt !== "string") {
        return reply.status(400).send({ error: "缺少 prompt" });
      }
      if (!validTypes.includes(type as PromptEnhanceType)) {
        return reply.status(400).send({ error: "无效的优化类型" });
      }
      if (creationType !== "image" && creationType !== "video") {
        return reply.status(400).send({ error: "无效的创作类型" });
      }

      const cleanPrompt = prompt.trim();
      if (!cleanPrompt) {
        return reply.status(400).send({ error: "prompt 不能为空" });
      }

      try {
        const res = await fetch(
          `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_CHAT_PATH}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${arkKey}`,
            },
            body: JSON.stringify({
              model: SEED_ENHANCE_ENDPOINT,
              temperature: 0.3,
              messages: [
                {
                  role: "system",
                  content: buildEnhanceSystemPrompt(
                    type as PromptEnhanceType,
                    creationType
                  ),
                },
                { role: "user", content: cleanPrompt },
              ],
            }),
          }
        );
        const data = (await res.json().catch(() => ({}))) as ArkChatResponse;
        if (!res.ok) {
          const errMsg =
            data.error?.message || `提示词优化请求失败: ${res.status}`;
          request.log.error(
            { status: res.status, data },
            "火山方舟提示词优化错误"
          );
          return reply.status(400).send({ error: errMsg });
        }
        const text = extractArkContent(data);
        if (!text) {
          return reply.status(502).send({ error: "提示词优化未返回有效内容" });
        }
        return { text };
      } catch (err) {
        request.log.error(err, "提示词优化请求异常");
        return reply.status(500).send({ error: "提示词优化失败，请稍后重试" });
      }
    }
  );

  /**
   * AI 生图路由，异步任务，实际生图在后台执行
   * 接收 prompt、aspectRatio、resolution、model、参考图、taskId
   */
  fastify.post<{ Body: AiImageRequest }>(
    "/api/ai/image",
    {
      preHandler: requireAuth,
      // 参考图走 Data URL 时体积较大，提升 body 限制避免 413
      bodyLimit: 50 * 1024 * 1024,
    },
    async (request, reply) => {
      // 取当前登录用户 id
      const userId = (request as { user?: { userId: string } }).user?.userId;
      if (!arkKey) {
        return reply.status(503).send({
          error: "AI 服务未配置，请在环境变量中设置 ARK_API_KEY",
        });
      }

      // 参数解包，赋默认值
      const {
        prompt,
        aspectRatio = "smart",
        resolution = "2k",
        model = "doubao-seedream-5.0-lite",
        referenceImages = [],
        taskId,
      } = request.body;

      // 参数校验
      if (!prompt || typeof prompt !== "string") {
        return reply.status(400).send({ error: "缺少 prompt" });
      }
      if (!taskId || typeof taskId !== "string") {
        return reply.status(400).send({ error: "缺少 taskId，请先创建任务" });
      }
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }
      const refs = Array.isArray(referenceImages)
        ? referenceImages.filter(
            (item): item is string => typeof item === "string"
          )
        : [];
      // 检查参考图类型，支持 DataURL、http(s) 图片
      if (
        refs.some(
          (item) =>
            !item.trim().startsWith("data:image/") &&
            !item.trim().startsWith("http://") &&
            !item.trim().startsWith("https://")
        )
      ) {
        return reply.status(400).send({
          error: "referenceImages 仅支持 Data URL 或 http(s) 图片 URL",
        });
      }
      // 特殊模型不支持参考图
      if (model === "doubao-seedream-3.0-t2i" && refs.length > 0) {
        return reply.status(400).send({
          error: "doubao-seedream-3.0-t2i 仅支持文生图，不支持参考图",
        });
      }
      // 限制最多 14 张参考图
      if (model !== "doubao-seedream-3.0-t2i" && refs.length > 14) {
        return reply.status(400).send({
          error: "参考图最多支持 14 张",
        });
      }

      // 获取环境变量 endpoint
      const envKey = MODEL_ENV_KEYS[model];
      const endpointId = envKey ? process.env[envKey] : undefined;

      if (!endpointId) {
        return reply.status(400).send({
          error: `模型 ${model} 未配置 Endpoint，请在 .env 中设置 ${envKey || "对应 Endpoint 环境变量"}`,
        });
      }

      // 尺寸映射
      const is4k = String(resolution).toLowerCase() === "4k";
      const aspectMap =
        model === "doubao-seedream-3.0-t2i"
          ? SIZE_3_0_T2I
          : is4k
            ? ASPECT_4K
            : ASPECT_2K;
      const size = aspectMap[aspectRatio] ?? aspectMap.smart;

      /** 将关联任务标为失败并广播（用于各错误出口） */
      const failTask = async (message: string) => {
        await update(taskId, userId, { status: "failed", message });
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      /** 更新任务进度并广播 */
      const setTaskProgress = async (updates: {
        progress?: number;
        message?: string;
        status?: string;
      }) => {
        await update(taskId, userId, updates);
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      // 将任务状态重置为 running
      const updated = await update(taskId, userId, {
        status: "running",
        progress: 0,
        message: "正在请求生成…",
      });
      if (updated === null) {
        return reply.status(404).send({ error: "任务不存在" });
      }
      const task = await findById(taskId);
      if (task) broadcastTaskUpdate(userId, task);
      // 立即 202，生图在后台执行，进度与结果通过 SSE 推送
      reply.status(202).send({ taskId });
      const baseUrl = getBaseUrl(request.headers, port);

      // 后台异步执行主逻辑
      (async () => {
        try {
          // 构造 API 请求体
          const url = `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_IMAGE_PATH}`;
          const body: Record<string, unknown> = {
            model: endpointId,
            prompt: prompt.trim(),
            n: 1,
            size,
            response_format: "url",
            watermark: false,
          };
          // 参考图相关填充
          if (model !== "doubao-seedream-3.0-t2i") {
            body.sequential_image_generation = "disabled";
            if (refs.length === 1) {
              body.image = refs[0];
            } else if (refs.length > 1) {
              body.image = refs;
            }
          }
          // 调用火山生图接口
          const res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${arkKey}`,
            },
            body: JSON.stringify(body),
          });
          const data = (await res.json().catch(() => ({}))) as ArkImageResponse;
          if (!res.ok) {
            const errMsg =
              (data as { error?: { message?: string } }).error?.message ||
              data.error?.message ||
              `请求失败: ${res.status}`;
            request.log.error(
              { status: res.status, data },
              "火山方舟 API 错误"
            );
            await failTask(errMsg);
            return;
          }
          const imageUrl = data.data?.[0]?.url;
          if (!imageUrl) {
            await failTask("AI 生成成功但未返回图片 URL");
            return;
          }
          await setTaskProgress({ progress: 40, message: "正在下载图片…" });

          // 下载生成图片
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) {
            request.log.warn(
              { status: imgRes.status, imageUrl },
              "下载 AI 图片失败"
            );
            await failTask("下载生成图片失败，请稍后重试");
            return;
          }
          // 解析扩展名和文件路径，按年月日存储
          const ext =
            path.extname(new URL(imageUrl).pathname).toLowerCase() || ".jpg";
          const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(
            ext
          )
            ? ext
            : ".jpg";
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const basename = `${randomUUID()}${safeExt}`;
          const relPath = `${year}/${month}/${day}/${basename}`;
          const filepath = path.join(uploadsDir, relPath);
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          const buffer = Buffer.from(await imgRes.arrayBuffer());
          fs.writeFileSync(filepath, buffer);

          // 入库到媒体库，并更新任务
          await setTaskProgress({ progress: 70, message: "正在入库…" });
          const shortPrompt = prompt.trim().slice(0, 16) || "无描述";
          const record = await addRecord(
            {
              name: `AI生图-${shortPrompt}-${Date.now()}${safeExt}`,
              type: "image",
              url: `/uploads/${relPath}`,
              filename: relPath,
              source: "ai",
            },
            userId
          );
          const recordWithUrl = withAbsoluteUrl(record, baseUrl);

          await update(taskId, userId, {
            status: "success",
            progress: 100,
            message: null,
            results: JSON.stringify([
              { url: recordWithUrl.url, record: recordWithUrl },
            ]),
          });
          const updatedTask = await findById(taskId);
          if (updatedTask) broadcastTaskUpdate(userId, updatedTask);
        } catch (err) {
          // 兜底异常
          request.log.error(err);
          const msg = err instanceof Error ? err.message : "AI 图片生成失败";
          await failTask(msg);
        }
      })().catch((err) => {
        // 兜底 promise 错误
        request.log.error(err, "AI 生图后台任务未捕获错误");
      });
    }
  );
}
