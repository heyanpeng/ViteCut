import path from "node:path";
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";

/**
 * 存储驱动类型，目前仅支持 oss
 */
export type StorageDriver = "oss";

/**
 * 存储作用域类型
 * user: 用户文件
 * ai:   AI生成/处理的文件
 * system: 系统文件
 */
export type StorageScope = "user" | "ai" | "system";

/**
 * 已签名可上传的URL信息
 */
export interface SignedUploadUrl {
  driver: "oss";
  method: "PUT";
  uploadUrl: string; // 本次上传用的签名URL
  objectKey: string;
  publicUrl: string; // 上传后可公开访问的URL
  expiresAt: number; // 过期时间戳(毫秒)
  headers?: Record<string, string>; // 建议上传时携带的请求头，如 Content-Type
}

/**
 * 以buffer上传文件所需参数
 */
export interface PutBufferInput {
  objectKey: string;
  buffer: Uint8Array;
  contentType?: string; // 内容类型(可选)
}

/**
 * 获取签名上传URL所需参数
 */
export interface CreateSignedUploadInput {
  objectKey: string;
  contentType?: string;
  expiresInSeconds?: number; // URL有效时长(秒)
}

/**
 * 获取签名读取URL所需参数
 */
export interface CreateSignedReadInput {
  objectKey: string;
  expiresInSeconds?: number; // URL有效时长(秒)
}

/**
 * 存储适配器接口
 */
export interface StorageAdapter {
  readonly driver: "oss";
  buildObjectKey(scope: StorageScope, filename: string, now?: Date): string;
  getPublicUrl(objectKey: string): string;
  extractObjectKey(url: string): string | null;
  getBuffer(objectKey: string): Promise<Uint8Array>;
  putBuffer(input: PutBufferInput): Promise<{ objectKey: string; url: string }>;
  createSignedUploadUrl(
    input: CreateSignedUploadInput
  ): Promise<SignedUploadUrl>;
  createSignedReadUrl(input: CreateSignedReadInput): Promise<string>;
  deleteObject(objectKey: string): Promise<void>;
}

/**
 * Oss适配器初始化参数
 */
interface OssOptions {
  region: string;
  bucket: string;
  accessKeyId: string;
  accessKeySecret: string;
  stsToken?: string;
  endpoint?: string;
  internal?: boolean;
  secure?: boolean;
  publicBaseUrl?: string; // 公共访问域名(可选)
  keyPrefix?: string; // 对象key前缀(可选)
}

/**
 * 去除key开头多余斜杠, 并规整连续斜杠
 */
function normalizeKey(key: string): string {
  return key.replace(/^\/+/, "").replace(/\/+/g, "/");
}

/**
 * 规范化公共访问域名，未带协议时默认补 https://
 */
function normalizePublicBaseUrl(url: string): string {
  const value = (url || "").trim();
  if (!value) return value;
  const normalized = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return normalized.replace(/\/$/, "");
}

/**
 * 保证生成文件名安全，只保留 a-zA-Z0-9._-
 */
function sanitizeFilename(filename: string): string {
  const base = path.basename(filename || "file");
  return base.replace(/[^a-zA-Z0-9._-]/g, "_");
}

/**
 * 生成日期前缀 yyyy/mm/dd
 */
function datePrefix(now: Date): string {
  const y = String(now.getFullYear());
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}/${m}/${d}`;
}

/**
 * OSS存储适配器
 */
class OssAdapter implements StorageAdapter {
  readonly driver = "oss" as const;
  private readonly client: OSS;
  private readonly publicBaseUrl: string;
  private readonly keyPrefix: string;

  /**
   * 构造函数
   */
  constructor(options: OssOptions) {
    this.client = new OSS({
      region: options.region,
      bucket: options.bucket,
      accessKeyId: options.accessKeyId,
      accessKeySecret: options.accessKeySecret,
      stsToken: options.stsToken,
      endpoint: options.endpoint,
      internal: options.internal,
      secure: options.secure ?? true,
      timeout: "60s",
    });

    // 公开访问域名，优先取配置，其次走默认规则
    this.publicBaseUrl = normalizePublicBaseUrl(
      options.publicBaseUrl ||
        `https://${options.bucket}.${options.endpoint || `oss-${options.region}.aliyuncs.com`}`
    );

    // key前缀规范化
    this.keyPrefix = normalizeKey(options.keyPrefix || "");
  }

  /**
   * 构建对象存储Key。含前缀/作用域/日期/随机文件名
   */
  buildObjectKey(
    scope: StorageScope,
    filename: string,
    now = new Date()
  ): string {
    const safe = sanitizeFilename(filename);
    // 自动补全扩展名，默认为 .bin
    const ext = path.extname(safe) || ".bin";
    const key = `${scope}/${datePrefix(now)}/${randomUUID()}${ext.toLowerCase()}`;
    return this.withPrefix(key);
  }

  /**
   * 获取对象的公开访问URL
   */
  getPublicUrl(objectKey: string): string {
    // encodeURIComponent处理斜杠为%2F后替换回原始斜杠
    return `${this.publicBaseUrl}/${encodeURIComponent(normalizeKey(objectKey)).replace(/%2F/g, "/")}`;
  }

  /**
   * 从公开/已知URL中提取出存储对象的Key
   */
  extractObjectKey(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      return decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
    } catch {
      return null;
    }
  }

  /**
   * 以buffer方式上传一个对象
   */
  async putBuffer(
    input: PutBufferInput
  ): Promise<{ objectKey: string; url: string }> {
    const objectKey = normalizeKey(input.objectKey);
    await this.client.put(objectKey, input.buffer, {
      // 允许用户指定 Content-Type
      headers: input.contentType
        ? { "Content-Type": input.contentType }
        : undefined,
    });
    return { objectKey, url: this.getPublicUrl(objectKey) };
  }

  /**
   * 从 OSS 读取对象内容
   */
  async getBuffer(objectKey: string): Promise<Uint8Array> {
    const key = normalizeKey(objectKey);
    const result = (await this.client.get(key)) as { content?: unknown };
    const content = result.content;
    if (content instanceof Uint8Array) {
      return content;
    }
    if (typeof content === "string") {
      return new TextEncoder().encode(content);
    }
    throw new Error(`读取 OSS 对象失败: ${key}`);
  }

  /**
   * 生成可供客户端直传的签名上传URL
   */
  async createSignedUploadUrl(
    input: CreateSignedUploadInput
  ): Promise<SignedUploadUrl> {
    const objectKey = normalizeKey(input.objectKey);
    // 最短60秒，最长1小时
    const expiresInSeconds = Math.max(
      60,
      Math.min(3600, input.expiresInSeconds ?? 900)
    );
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const uploadUrl = await this.client.signatureUrl(objectKey, {
      method: "PUT",
      expires: expiresInSeconds,
    });

    return {
      driver: "oss",
      method: "PUT",
      uploadUrl,
      objectKey,
      publicUrl: this.getPublicUrl(objectKey),
      expiresAt,
      // 不在签名中绑定 Content-Type，避免浏览器自动注入/改写导致签名不匹配。
      headers: undefined,
    };
  }

  /**
   * 生成对象读取的签名URL，适用于私有Bucket资源访问
   */
  async createSignedReadUrl(input: CreateSignedReadInput): Promise<string> {
    const objectKey = normalizeKey(input.objectKey);
    // 最短60秒，最长1小时
    const expiresInSeconds = Math.max(
      60,
      Math.min(3600, input.expiresInSeconds ?? 900)
    );
    return this.client.signatureUrl(objectKey, {
      method: "GET",
      expires: expiresInSeconds,
    });
  }

  /**
   * 删除对象，如果对象不存在不会报错
   */
  async deleteObject(objectKey: string): Promise<void> {
    const key = normalizeKey(objectKey);
    try {
      await this.client.delete(key);
    } catch (err) {
      // OSS接口如果对象不存在会抛出错误，兼容处理无此key时不抛异常
      const code = (err as { code?: string })?.code;
      if (code !== "NoSuchKey") {
        throw err;
      }
    }
  }

  /**
   * 给对象key加上全局配置的key前缀
   */
  private withPrefix(key: string): string {
    const normalized = normalizeKey(key);
    return this.keyPrefix
      ? normalizeKey(`${this.keyPrefix}/${normalized}`)
      : normalized;
  }
}

/**
 * 从环境变量生产一个OSS适配器实例，常用于服务端启动时初始化
 */
export function createStorageAdapterFromEnv(): StorageAdapter {
  const region = process.env.OSS_REGION || "";
  const bucket = process.env.OSS_BUCKET || "";
  const accessKeyId = process.env.OSS_ACCESS_KEY_ID || "";
  const accessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || "";

  if (!region || !bucket || !accessKeyId || !accessKeySecret) {
    throw new Error(
      "必须配置 OSS_REGION/OSS_BUCKET/OSS_ACCESS_KEY_ID/OSS_ACCESS_KEY_SECRET"
    );
  }

  return new OssAdapter({
    region,
    bucket,
    accessKeyId,
    accessKeySecret,
    stsToken: process.env.OSS_STS_TOKEN,
    endpoint: process.env.OSS_ENDPOINT || undefined,
    internal: process.env.OSS_INTERNAL === "true",
    secure: process.env.OSS_SECURE !== "false",
    publicBaseUrl: process.env.OSS_PUBLIC_BASE_URL || undefined,
    keyPrefix: process.env.OSS_KEY_PREFIX || undefined,
  });
}
