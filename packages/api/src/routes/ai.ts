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
import { getBaseUrl } from "../utils/baseUrl.js";

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

export interface AiRoutesOptions {
  uploadsDir: string;
  port: number;
}

const ARK_BASE_URL =
  process.env.ARK_BASE_URL || "https://ark.cn-beijing.volces.com/api/v3";
const ARK_IMAGE_PATH = "/images/generations";

/** 前端 model id -> 环境变量名 */
const MODEL_ENV_KEYS: Record<string, string> = {
  "doubao-seedream-5.0-lite": "ARK_ENDPOINT_DOUBAO_SEEDREAM_5_0_LITE",
  "doubao-seedream-4.5": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_5",
  "doubao-seedream-4.0": "ARK_ENDPOINT_DOUBAO_SEEDREAM_4_0",
  "doubao-seedream-3.0-t2i": "ARK_ENDPOINT_DOUBAO_SEEDREAM_3_0_T2I",
};

/**
 * 前端 aspect_ratio + resolution -> 火山方舟 size
 * 参考：https://shihuo.mintlify.app/api-reference/image-generation
 * size 支持 "2K"、"4K" 或 "宽x高" 格式
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

interface AiImageRequest {
  prompt: string;
  aspectRatio?: string;
  resolution?: string; // "2k" | "4k"
  model?: string;
}

interface ArkImageResponse {
  data?: Array<{ url?: string; b64_json?: string }>;
  error?: { code?: string; message?: string };
}

export async function aiRoutes(
  fastify: FastifyInstance,
  opts: AiRoutesOptions
): Promise<void> {
  const { uploadsDir, port } = opts;
  const arkKey = process.env.ARK_API_KEY;
  if (!arkKey) {
    fastify.log.warn(
      "[ai] ARK_API_KEY 未配置，火山方舟图片生成接口将不可用"
    );
  }

  fastify.post<{ Body: AiImageRequest }>(
    "/api/ai/image",
    async (request, reply) => {
      if (!arkKey) {
        return reply.status(503).send({
          error: "AI 服务未配置，请在环境变量中设置 ARK_API_KEY",
        });
      }

      const {
        prompt,
        aspectRatio = "smart",
        resolution = "2k",
        model = "doubao-seedream-5.0-lite",
      } = request.body;

      if (!prompt || typeof prompt !== "string") {
        return reply.status(400).send({ error: "缺少 prompt" });
      }

      const envKey = MODEL_ENV_KEYS[model];
      const endpointId = envKey ? process.env[envKey] : undefined;

      if (!endpointId) {
        return reply.status(400).send({
          error: `模型 ${model} 未配置 Endpoint，请在 .env 中设置 ${envKey || "对应 Endpoint 环境变量"}`,
        });
      }

      const is4k = String(resolution).toLowerCase() === "4k";
      const aspectMap = is4k ? ASPECT_4K : ASPECT_2K;
      const size = aspectMap[aspectRatio] ?? aspectMap.smart;

      try {
        const url = `${ARK_BASE_URL.replace(/\/$/, "")}${ARK_IMAGE_PATH}`;
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${arkKey}`,
          },
          body: JSON.stringify({
            model: endpointId,
            prompt: prompt.trim(),
            n: 1,
            size,
            response_format: "url",
            sequential_image_generation: "disabled",
            watermark: false,
          }),
        });

        const data = (await res.json().catch(() => ({}))) as ArkImageResponse;

        if (!res.ok) {
          const errMsg =
            (data as { error?: { message?: string } }).error?.message ||
            data.error?.message ||
            `请求失败: ${res.status}`;
          request.log.error({ status: res.status, data }, "火山方舟 API 错误");
          return reply.status(res.status >= 500 ? 502 : res.status).send({
            error: errMsg,
          });
        }

        const imageUrl = data.data?.[0]?.url;
        if (!imageUrl) {
          return reply.status(500).send({
            error: "AI 生成成功但未返回图片 URL",
          });
        }

        // 后端下载图片到 uploads，再入库（避免火山临时 URL 24h 过期）
        const imgRes = await fetch(imageUrl);
        if (!imgRes.ok) {
          request.log.warn({ status: imgRes.status, imageUrl }, "下载 AI 图片失败");
          return reply.status(502).send({
            error: "下载生成图片失败，请稍后重试",
          });
        }
        const ext =
          path.extname(new URL(imageUrl).pathname).toLowerCase() || ".jpg";
        const safeExt = [".jpg", ".jpeg", ".png", ".gif", ".webp"].includes(ext)
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

        const shortPrompt = prompt.trim().slice(0, 16) || "无描述";
        const record = await addRecord({
          name: `AI生图-${shortPrompt}-${Date.now()}${safeExt}`,
          type: "image",
          url: `/uploads/${relPath}`,
          filename: relPath,
        });

        const baseUrl = getBaseUrl(request.headers, port);
        const recordWithUrl = withAbsoluteUrl(record, baseUrl);
        return { imageUrl: recordWithUrl.url, record: recordWithUrl };
      } catch (err) {
        request.log.error(err);
        const msg =
          err instanceof Error ? err.message : "AI 图片生成失败";
        return reply.status(500).send({ error: msg });
      }
    }
  );
}
