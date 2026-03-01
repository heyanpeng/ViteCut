/**
 * 火山方舟 Seedream 图片/视频生成 API 接入路由与核心工具
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
import { generateVideoThumbnail, getVideoDuration } from "../lib/videoThumbnail.js";

/**
 * 给资源的相对 url 或 coverUrl 补齐成绝对地址（针对静态文件提供完整可访问 http(s) 地址）
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

// ark 平台基础配置及路径常量
const ARK_BASE_URL =
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_IMAGE_PATH = "/images/generations";
const ARK_CHAT_PATH = "/chat/completions";
const ARK_CONTENT_TASK_PATH = "/contents/generations/tasks";

/**
 * 前端 model id -> 环境变量名一览（每个模型对应火山方舟的 endpoint）
 * 用于兼容不同模型，不同 endpoint 走不同变量
 */
const MODEL_ENV_KEYS: Record<string, string> = {
  "doubao-seedream-5.0-lite": "ARK_ENDPOINT_DOUBAO_SEEDREAM_5_0_LITE",
  "doubao-seedream-4.5": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_5",
  "doubao-seedream-4.0": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_0",
  "doubao-seedream-3.0-t2i": "ARK_ENDPOINT_DOUBAO_SEEDREAM_3_0_T2I",
  "doubao-seed-1.8": "ARK_ENDPOINT_SEED_1_8",
  "seedance-1.5-pro": "ARK_ENDPOINT_SEEDANCE_1_5_PRO",
  "seedance-1.0-pro": "ARK_ENDPOINT_SEEDANCE_1_0_PRO",
};

// doubao-seed-1.8 增强模型 Endpoint 环境变量名
const SEED_ENHANCE_ENDPOINT_ENV_KEY = MODEL_ENV_KEYS["doubao-seed-1.8"];
// 读取实际增强模型 endpoint
const SEED_ENHANCE_ENDPOINT = process.env[SEED_ENHANCE_ENDPOINT_ENV_KEY];

/**
 * 前端 aspect_ratio + resolution -> 火山方舟 size「尺寸映射表」
 *
 * - size 支持 "2K"、"4K" 或 "宽x高" 格式，用于生成图片尺寸
 * - 参考文档：https://shihuo.mintlify.app/api-reference/image-generation
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
// doubao-seedream-3.0-t2i 只支持 "宽x高" 格式，不支持 2K/4K 直传
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
  prompt: string; // 生成图像的提示词
  aspectRatio?: string; // 宽高比，默认 smart（不固定，例如 "1:1"）
  resolution?: string; // "2k" | "4k"，图片分辨率
  model?: string; // 使用的模型 id
  referenceImages?: string[]; // 参考图的 Data URL 或 http(s) 地址数组
  /** 必填：关联的后端任务 id，生成过程中会更新任务状态并通过 SSE 推送给前端 */
  taskId: string;
}

/**
 * /api/ai/video POST 请求 body
 * 支持以图生视频，imageUrl 可以省略（仅文生视频）
 */
interface AiVideoRequest {
  prompt: string; // 生成视频的提示词
  model?: string; // 指定视频生成模型
  imageUrl?: string; // 初始图片的 Data URL 或 http(s) 地址
  resolution?: "480p" | "720p" | "1080p";
  ratio?: "1:1" | "16:9" | "9:16" | "4:3" | "3:4" | "21:9";
  duration?: number; // 视频时长（秒）
  frames?: number; // 帧数（二选一）
  seed?: number;
  camera_fixed?: boolean;
  watermark?: boolean;
  taskId: string; // 任务 id
}

/**
 * 火山返回的图片生成响应格式
 * data: 包含图片 url 或 base64
 * error: 错误信息（可选）
 */
interface ArkImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { code?: string; message?: string };
}

/**
 * 内容生成/视频生成任务创建与明细响应（火山方舟）
 */
interface ArkContentTaskCreateResponse {
  id?: string;
  task_id?: string;
  status?: string;
  output?: { url?: string; video_url?: string };
  content?: { video_url?: string; url?: string };
  error?: { code?: string; message?: string };
}

/**
 * 支持的提示词增强类型
 */
type PromptEnhanceType =
  | "proofread" // 校对/纠错
  | "polish" // 润色
  | "expand" // 扩写
  | "abbreviate" // 精简
  | "more-fun" // 风格更有趣
  | "more-pro"; // 风格更专业

/**
 * /api/ai/prompt-enhance POST body
 */
interface PromptEnhanceRequest {
  prompt: string; // 需优化的提示词
  type: PromptEnhanceType; // 增强类型
  creationType: "image" | "video"; // 创作类型（区分最大长度）
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
 * 构建系统 prompt，教火山 AI 如何处理提示词增强任务
 * @param type 增强类型
 * @param creationType 创作类型（决定提示内容和长度限制）
 * @returns string 完整 system prompt
 */
function buildEnhanceSystemPrompt(
  type: PromptEnhanceType,
  creationType: "image" | "video"
): string {
  const target = creationType === "video" ? "视频生成" : "图片生成";
  // 每种增强类型的中文描述
  const actionMap: Record<PromptEnhanceType, string> = {
    proofread: "校对语法与错别字，保持原意",
    polish: "润色表达，提高可读性和专业性",
    expand: "在保留原意下扩写细节，让描述更完整",
    abbreviate: "在保留关键信息下精简表达",
    "more-fun": "让风格更有趣、更生动",
    "more-pro": "让风格更专业、更商业化",
  };
  const maxLen = creationType === "video" ? 500 : 200; // 视频/图片分别控制长度
  return [
    `你是${target}提示词优化助手。`,
    `任务：${actionMap[type]}。`,
    "仅返回优化后的最终中文提示词，不要解释、不要加引号、不要分点。",
    `严格控制长度不超过 ${maxLen} 个字符。`,
  ].join("");
}

/**
 * 提取 chat/completions 的有效内容
 * @param data ArkChatResponse
 * @returns string 提示词内容
 */
function extractArkContent(data: ArkChatResponse): string {
  const content = data.choices?.[0]?.message?.content;
  if (typeof content === "string") return content.trim();
  if (Array.isArray(content)) {
    // fire-and-forget: 只保留 type=text 的文本
    return content
      .map((item) => (item?.type === "text" ? (item.text ?? "") : ""))
      .join("")
      .trim();
  }
  return "";
}

/**
 * 提取内容生成任务 id（容错 id/task_id 字段）
 */
function getContentTaskId(data: Record<string, unknown>): string | null {
  const id = data.id;
  const taskId = data.task_id;
  if (typeof id === "string" && id.trim()) return id;
  if (typeof taskId === "string" && taskId.trim()) return taskId;
  return null;
}

/**
 * 提取内容生成任务的状态（转换为小写字符串）
 */
function getContentTaskStatus(data: Record<string, unknown>): string {
  const status = data.status;
  return typeof status === "string" ? status.toLowerCase() : "";
}

/**
 * 尝试从多处提取视频生成结果的可下载 video_url
 * 优先 video_url 字段，其次 url，再到 output、content 嵌套结构
 */
function getVideoUrl(data: Record<string, unknown>): string | null {
  const direct = data.video_url;
  if (typeof direct === "string" && direct) return direct;
  const url = data.url;
  if (typeof url === "string" && url) return url;
  const output = data.output as Record<string, unknown> | undefined;
  if (output) {
    const outVideo = output.video_url;
    if (typeof outVideo === "string" && outVideo) return outVideo;
    const outUrl = output.url;
    if (typeof outUrl === "string" && outUrl) return outUrl;
  }
  const content = data.content as Record<string, unknown> | undefined;
  if (content) {
    const cVideo = content.video_url;
    if (typeof cVideo === "string" && cVideo) return cVideo;
    const cUrl = content.url;
    if (typeof cUrl === "string" && cUrl) return cUrl;
  }
  return null;
}

/**
 * fastify 路由注入入口
 * 注册 /api/ai/prompt-enhance、/api/ai/video、/api/ai/image 三个路由
 * 限流、鉴权等见 requireAuth
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
   * 支持多种优化类型、自动选择增强模型
   * 校验参数，防止异常输入
   */
  fastify.post<{ Body: PromptEnhanceRequest }>(
    "/api/ai/prompt-enhance",
    { preHandler: requireAuth },
    async (request, reply) => {
      // 校验 arkKey 与增强 endpoint 配置
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
        // 构建并调用火山增强聊天接口
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
        // 尝试解析返回内容
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
        // 提取增强结果内容
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
   * AI 视频生成路由
   * 支持以图生视频或仅文本 prompt
   * 创建 Ark 内容生成任务、轮询进度、视频文件下载和落地，并同步任务状态（SSE）
   */
  fastify.post<{ Body: AiVideoRequest }>(
    "/api/ai/video",
    { preHandler: requireAuth, bodyLimit: 50 * 1024 * 1024 },
    async (request, reply) => {
      // 提取当前用户 id（request.user 已通过 requireAuth 注入）
      const userId = (request as { user?: { userId: string } }).user?.userId;
      if (!arkKey) {
        return reply.status(503).send({
          error: "AI 服务未配置，请在环境变量中设置 ARK_API_KEY",
        });
      }
      // 参数解包，赋默认模型
      const {
        prompt,
        model = "seedance-1.5-pro",
        imageUrl,
        resolution = "720p",
        ratio = "16:9",
        duration = 5,
        frames,
        seed,
        camera_fixed = false,
        watermark = true,
        taskId,
      } = request.body || {};
      if (!userId) {
        return reply.status(401).send({ error: "未登录" });
      }
      if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
        return reply.status(400).send({ error: "缺少 prompt" });
      }
      if (!taskId || typeof taskId !== "string") {
        return reply.status(400).send({ error: "缺少 taskId，请先创建任务" });
      }
      const safeDuration = duration == null ? undefined : Math.round(Number(duration));
      if (
        safeDuration != null &&
        (!Number.isFinite(safeDuration) || safeDuration < 1 || safeDuration > 30)
      ) {
        return reply.status(400).send({ error: "duration 仅支持 1-30 秒" });
      }
      if (frames != null) {
        const safeFrames = Math.round(Number(frames));
        if (!Number.isFinite(safeFrames) || safeFrames < 1) {
          return reply.status(400).send({ error: "frames 必须是大于 0 的整数" });
        }
      }
      if (safeDuration == null && frames == null) {
        return reply.status(400).send({ error: "duration 和 frames 至少传一个" });
      }
      if (!["480p", "720p", "1080p"].includes(String(resolution))) {
        return reply.status(400).send({ error: "resolution 仅支持 480p/720p/1080p" });
      }
      if (!["1:1", "16:9", "9:16", "4:3", "3:4", "21:9"].includes(String(ratio))) {
        return reply.status(400).send({ error: "ratio 不合法" });
      }
      if (seed != null && (!Number.isFinite(Number(seed)) || Number(seed) < 0)) {
        return reply.status(400).send({ error: "seed 必须是非负数字" });
      }
      // imageUrl 仅支持图片 Data URL 或 http(s) 链接
      if (
        imageUrl &&
        typeof imageUrl === "string" &&
        !imageUrl.trim().startsWith("data:image/") &&
        !imageUrl.trim().startsWith("http://") &&
        !imageUrl.trim().startsWith("https://")
      ) {
        return reply.status(400).send({
          error: "imageUrl 仅支持 Data URL 或 http(s) 图片 URL",
        });
      }

      // 提取 endpoint
      const envKey = MODEL_ENV_KEYS[model];
      const endpointId = envKey ? process.env[envKey] : undefined;
      if (!endpointId) {
        return reply.status(400).send({
          error: `模型 ${model} 未配置 Endpoint，请在 .env 中设置 ${envKey || "对应 Endpoint 环境变量"}`,
        });
      }

      /**
       * 标记任务失败并广播状态
       * @param message 失败原因
       */
      const failTask = async (message: string) => {
        await update(taskId, userId, { status: "failed", message });
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };
      /**
       * 更新任务进度并广播（主要用于轮询阶段与文件落地时的进度提示）
       */
      const setTaskProgress = async (updates: {
        progress?: number;
        message?: string;
        status?: string;
      }) => {
        await update(taskId, userId, updates);
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      // 先重置为 running，显示进度，并初步广播（保证任务状态新鲜，方便客户端同步）
      const updated = await update(taskId, userId, {
        status: "running",
        progress: 0,
        message: "正在提交视频生成任务…",
      });
      if (updated === null) {
        return reply.status(404).send({ error: "任务不存在" });
      }
      const task = await findById(taskId);
      if (task) broadcastTaskUpdate(userId, task);
      // 立即响应 202，前端可继续通过 SSE 收状态
      reply.status(202).send({ taskId });

      const baseUrl = getBaseUrl(request.headers, port);
      // 后台异步：火山任务创建、轮询进度、视频下载与落地、入库、SSE 广播
      (async () => {
        try {
          // === 步骤1 创建 Ark 内容生成任务 ===
          const createRes = await fetch(
            `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_CONTENT_TASK_PATH}`,
            {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${arkKey}`,
              },
              body: JSON.stringify({
                model: endpointId,
                content: [
                  {
                    type: "text",
                    text: prompt.trim(),
                  },
                  ...(imageUrl
                    ? [
                        {
                          type: "image_url",
                          image_url: { url: imageUrl.trim() },
                        },
                      ]
                    : []),
                ],
                resolution,
                ratio,
                ...(safeDuration != null ? { duration: safeDuration } : {}),
                ...(frames != null ? { frames: Math.round(Number(frames)) } : {}),
                ...(seed != null ? { seed: Number(seed) } : {}),
                camera_fixed,
                watermark,
              }),
            }
          );
          const createData = (await createRes
            .json()
            .catch(() => ({}))) as ArkContentTaskCreateResponse;
          if (!createRes.ok) {
            const msg =
              createData.error?.message || `请求失败: ${createRes.status}`;
            request.log.error(
              { status: createRes.status, data: createData },
              "火山方舟视频任务创建错误"
            );
            await failTask(msg);
            return;
          }
          // 提取任务 id 和初始 status/video_url
          const createObj = createData as unknown as Record<string, unknown>;
          const contentTaskId = getContentTaskId(createObj);
          let status = getContentTaskStatus(createObj);
          let videoUrl = getVideoUrl(createObj);
          if (!contentTaskId && !videoUrl) {
            await failTask("视频任务创建成功但未返回 task id");
            return;
          }

          // === 步骤2 轮询火山内容生成进度，最多 3 分钟 ===
          for (let i = 0; i < 90 && !videoUrl; i += 1) {
            if (status === "failed" || status === "error") break;
            // 进度递增（最多 85%），防止客户端空转
            await setTaskProgress({
              progress: Math.min(85, 10 + Math.floor(i * 0.8)),
              message: "视频生成中，请稍候…",
            });
            await new Promise((resolve) => setTimeout(resolve, 2000));
            if (!contentTaskId) break;
            const detailRes = await fetch(
              `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_CONTENT_TASK_PATH}/${contentTaskId}`,
              {
                method: "GET",
                headers: {
                  Authorization: `Bearer ${arkKey}`,
                },
              }
            );
            const detailData = (await detailRes
              .json()
              .catch(() => ({}))) as ArkContentTaskCreateResponse;
            if (!detailRes.ok) {
              const msg =
                detailData.error?.message ||
                `查询任务失败: ${detailRes.status}`;
              await failTask(msg);
              return;
            }
            const detailObj = detailData as unknown as Record<string, unknown>;
            status = getContentTaskStatus(detailObj);
            videoUrl = getVideoUrl(detailObj);
            if (status === "failed" || status === "error") {
              const errMsg =
                detailData.error?.message || "视频生成失败，请稍后重试";
              await failTask(errMsg);
              return;
            }
          }
          if (!videoUrl) {
            await failTask("视频生成超时，请稍后到任务列表重试");
            return;
          }

          // === 步骤3 下载生成视频文件并保存到 uploads 目录 ===
          await setTaskProgress({ progress: 90, message: "正在下载视频…" });
          const videoRes = await fetch(videoUrl);
          if (!videoRes.ok) {
            await failTask("下载生成视频失败，请稍后重试");
            return;
          }
          // 按年月日生成 unique 路径，安全扩展名
          const ext =
            path.extname(new URL(videoUrl).pathname).toLowerCase() || ".mp4";
          const safeExt = [".mp4", ".mov", ".webm", ".mkv"].includes(ext)
            ? ext
            : ".mp4";
          const now = new Date();
          const year = now.getFullYear();
          const month = String(now.getMonth() + 1).padStart(2, "0");
          const day = String(now.getDate()).padStart(2, "0");
          const basename = `${randomUUID()}${safeExt}`;
          const relPath = `${year}/${month}/${day}/${basename}`;
          const filepath = path.join(uploadsDir, relPath);
          fs.mkdirSync(path.dirname(filepath), { recursive: true });
          const buffer = Buffer.from(await videoRes.arrayBuffer());
          fs.writeFileSync(filepath, buffer);
          await setTaskProgress({ progress: 95, message: "正在生成封面…" });

          // 生成视频封面与时长，写入媒体记录的 coverUrl/duration
          const coverRel = `${year}/${month}/${day}/${path.basename(basename, safeExt)}_cover.png`;
          const coverPath = path.join(uploadsDir, coverRel);
          const coverOk = await generateVideoThumbnail(filepath, coverPath, 0.5);
          const coverUrl = coverOk ? `/uploads/${coverRel}` : undefined;
          const videoDuration = await getVideoDuration(filepath);

          // === 步骤4 入库到媒体库，更新任务状态，广播 ===
          const shortPrompt = prompt.trim().slice(0, 16) || "无描述";
          const record = await addRecord(
            {
              name: `AI生视频-${shortPrompt}-${Date.now()}${safeExt}`,
              type: "video",
              url: `/uploads/${relPath}`,
              filename: relPath,
              coverUrl,
              duration: videoDuration ?? undefined,
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
          // 兜底异常（如网络或本地 IO 错误等）
          request.log.error(err, "AI 生视频后台任务异常");
          const msg = err instanceof Error ? err.message : "AI 视频生成失败";
          await failTask(msg);
        }
      })().catch((err) => {
        // 兜底 promise 未捕获异常
        request.log.error(err, "AI 生视频后台任务未捕获错误");
      });
    }
  );

  /**
   * AI 生图路由，异步任务
   * 参数校验、模型尺寸映射、请求火山接口、下载粘贴、入库媒体库、SSE 推送任务状态
   * 客户端需先创建任务（生成 taskId），后端以 taskId 唯一标识每一次生成进度
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
      // 保证参考图均为 string
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
      // doubao-seedream-3.0-t2i 只支持文生图，不支持参考图
      if (model === "doubao-seedream-3.0-t2i" && refs.length > 0) {
        return reply.status(400).send({
          error: "doubao-seedream-3.0-t2i 仅支持文生图，不支持参考图",
        });
      }
      // 参考图张数限制
      if (model !== "doubao-seedream-3.0-t2i" && refs.length > 14) {
        return reply.status(400).send({
          error: "参考图最多支持 14 张",
        });
      }

      // 获取 endpoint id
      const envKey = MODEL_ENV_KEYS[model];
      const endpointId = envKey ? process.env[envKey] : undefined;

      if (!endpointId) {
        return reply.status(400).send({
          error: `模型 ${model} 未配置 Endpoint，请在 .env 中设置 ${envKey || "对应 Endpoint 环境变量"}`,
        });
      }

      // 大小&分辨率映射
      const is4k = String(resolution).toLowerCase() === "4k";
      const aspectMap =
        model === "doubao-seedream-3.0-t2i"
          ? SIZE_3_0_T2I
          : is4k
            ? ASPECT_4K
            : ASPECT_2K;
      const size = aspectMap[aspectRatio] ?? aspectMap.smart;

      /** 将关联任务标为失败并广播（用于各错误出口统一处理） */
      const failTask = async (message: string) => {
        await update(taskId, userId, { status: "failed", message });
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      /** 更新任务进度并广播（进度包含大致 “下载图片”、“入库”等状态） */
      const setTaskProgress = async (updates: {
        progress?: number;
        message?: string;
        status?: string;
      }) => {
        await update(taskId, userId, updates);
        const task = await findById(taskId);
        if (task) broadcastTaskUpdate(userId, task);
      };

      // 任务置为 running，并广播
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

      // 后台异步执行主逻辑（火山方舟 API + 文件落地 + 媒体入库 + 任务状态更新）
      (async () => {
        try {
          // === 步骤1：构造 API 请求体 ===
          const url = `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_IMAGE_PATH}`;
          const body: Record<string, unknown> = {
            model: endpointId,
            prompt: prompt.trim(),
            n: 1,
            size,
            response_format: "url",
            watermark: false,
          };
          // 参考图参数（3.0-t2i 禁止；其它模型允许 1-14 张）
          if (model !== "doubao-seedream-3.0-t2i") {
            body.sequential_image_generation = "disabled";
            if (refs.length === 1) {
              body.image = refs[0];
            } else if (refs.length > 1) {
              body.image = refs;
            }
          }
          // === 步骤2：调用火山生图接口 ===
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
          // 提取出返回图片 url
          const imageUrl = data.data?.[0]?.url;
          if (!imageUrl) {
            await failTask("AI 生成成功但未返回图片 URL");
            return;
          }
          await setTaskProgress({ progress: 40, message: "正在下载图片…" });

          // === 步骤3：下载图片本地落地 ===
          const imgRes = await fetch(imageUrl);
          if (!imgRes.ok) {
            request.log.warn(
              { status: imgRes.status, imageUrl },
              "下载 AI 图片失败"
            );
            await failTask("下载生成图片失败，请稍后重试");
            return;
          }
          // 统一按 年/月/日 路径，防止冲突（安全白名单扩展名）
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

          // === 步骤4：入库（媒体库/图片管理），更新任务，广播 ===
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
          // 兜底异常：本地落地、网络、文件、未知
          request.log.error(err);
          const msg = err instanceof Error ? err.message : "AI 图片生成失败";
          await failTask(msg);
        }
      })().catch((err) => {
        // 兜底 promise 错误（异步未捕获）
        request.log.error(err, "AI 生图后台任务未捕获错误");
      });
    }
  );
}
