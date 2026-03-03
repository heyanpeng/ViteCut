import path from "node:path";
import { randomUUID } from "node:crypto";
import OSS from "ali-oss";
import { Client as MinioClient } from "minio";

/**
 * 存储驱动类型
 */
export type StorageDriver = "oss" | "minio";

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
  driver: StorageDriver;
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
  readonly driver: StorageDriver;
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
 * MinIO适配器初始化参数
 */
interface MinioOptions {
  endPoint: string;
  port?: number;
  useSSL?: boolean;
  bucket: string;
  accessKey: string;
  secretKey: string;
  sessionToken?: string;
  region?: string;
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
 * 解析布尔环境变量，支持 true/false/1/0/y/n
 */
function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (!value) return defaultValue;
  const normalized = value.trim().toLowerCase();
  if (["1", "true", "yes", "y", "on"].includes(normalized)) return true;
  if (["0", "false", "no", "n", "off"].includes(normalized)) return false;
  return defaultValue;
}

/**
 * 规范化 endpoint 主机名，移除协议和尾部斜杠
 */
function normalizeEndpointHost(endpoint: string): string {
  return endpoint
    .trim()
    .replace(/^https?:\/\//i, "")
    .replace(/\/+$/, "");
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
 * MinIO对象存储适配器
 */
class MinioAdapter implements StorageAdapter {
  readonly driver = "minio" as const;
  private readonly client: MinioClient;
  private readonly bucket: string;
  private readonly publicBaseUrl: string;
  private readonly keyPrefix: string;

  /**
   * 构造函数
   */
  constructor(options: MinioOptions) {
    const endPoint = normalizeEndpointHost(options.endPoint);
    const useSSL = options.useSSL ?? true;

    this.client = new MinioClient({
      endPoint,
      port: options.port,
      useSSL,
      accessKey: options.accessKey,
      secretKey: options.secretKey,
      sessionToken: options.sessionToken,
      region: options.region,
    });
    this.bucket = options.bucket;

    const portPart =
      options.port == null ||
      (useSSL && options.port === 443) ||
      (!useSSL && options.port === 80)
        ? ""
        : `:${options.port}`;
    this.publicBaseUrl = normalizePublicBaseUrl(
      options.publicBaseUrl ||
        `${useSSL ? "https" : "http"}://${endPoint}${portPart}/${options.bucket}`
    );

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
    const ext = path.extname(safe) || ".bin";
    const key = `${scope}/${datePrefix(now)}/${randomUUID()}${ext.toLowerCase()}`;
    return this.withPrefix(key);
  }

  /**
   * 获取对象的公开访问URL
   */
  getPublicUrl(objectKey: string): string {
    return `${this.publicBaseUrl}/${encodeURIComponent(normalizeKey(objectKey)).replace(/%2F/g, "/")}`;
  }

  /**
   * 从公开/已知URL中提取出存储对象的Key
   */
  extractObjectKey(url: string): string | null {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      let key = decodeURIComponent(parsed.pathname.replace(/^\/+/, ""));
      const bucketPrefix = `${this.bucket}/`;
      if (key.startsWith(bucketPrefix)) {
        key = key.slice(bucketPrefix.length);
      }
      return key;
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
    await this.client.putObject(
      this.bucket,
      objectKey,
      Buffer.from(input.buffer),
      input.buffer.length,
      input.contentType ? { "Content-Type": input.contentType } : undefined
    );
    return { objectKey, url: this.getPublicUrl(objectKey) };
  }

  /**
   * 从 MinIO 读取对象内容
   */
  async getBuffer(objectKey: string): Promise<Uint8Array> {
    const key = normalizeKey(objectKey);
    const stream = await this.client.getObject(this.bucket, key);
    const chunks: Buffer[] = [];
    for await (const chunk of stream) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    return new Uint8Array(Buffer.concat(chunks));
  }

  /**
   * 生成可供客户端直传的签名上传URL
   */
  async createSignedUploadUrl(
    input: CreateSignedUploadInput
  ): Promise<SignedUploadUrl> {
    const objectKey = normalizeKey(input.objectKey);
    const expiresInSeconds = Math.max(
      60,
      Math.min(3600, input.expiresInSeconds ?? 900)
    );
    const expiresAt = Date.now() + expiresInSeconds * 1000;
    const uploadUrl = await this.client.presignedPutObject(
      this.bucket,
      objectKey,
      expiresInSeconds
    );

    return {
      driver: "minio",
      method: "PUT",
      uploadUrl,
      objectKey,
      publicUrl: this.getPublicUrl(objectKey),
      expiresAt,
      headers: undefined,
    };
  }

  /**
   * 生成对象读取的签名URL，适用于私有Bucket资源访问
   */
  async createSignedReadUrl(input: CreateSignedReadInput): Promise<string> {
    const objectKey = normalizeKey(input.objectKey);
    const expiresInSeconds = Math.max(
      60,
      Math.min(3600, input.expiresInSeconds ?? 900)
    );
    return this.client.presignedGetObject(this.bucket, objectKey, expiresInSeconds);
  }

  /**
   * 删除对象，如果对象不存在不会报错
   */
  async deleteObject(objectKey: string): Promise<void> {
    const key = normalizeKey(objectKey);
    try {
      await this.client.removeObject(this.bucket, key);
    } catch (err) {
      const code = (err as { code?: string })?.code;
      if (code !== "NoSuchKey" && code !== "NotFound") {
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
 * 从环境变量创建存储适配器实例，常用于服务端启动时初始化
 */
export function createStorageAdapterFromEnv(): StorageAdapter {
  const driver = (process.env.STORAGE_DRIVER || "oss").trim().toLowerCase();

  if (driver === "minio") {
    const endPoint = process.env.MINIO_ENDPOINT || "";
    const bucket = process.env.MINIO_BUCKET || "";
    const accessKey = process.env.MINIO_ACCESS_KEY || "";
    const secretKey = process.env.MINIO_SECRET_KEY || "";

    if (!endPoint || !bucket || !accessKey || !secretKey) {
      throw new Error(
        "使用 MinIO 驱动时必须配置 MINIO_ENDPOINT/MINIO_BUCKET/MINIO_ACCESS_KEY/MINIO_SECRET_KEY"
      );
    }

    const portRaw = process.env.MINIO_PORT?.trim();
    const parsedPort = portRaw ? Number(portRaw) : undefined;
    const isValidPort =
      parsedPort !== undefined &&
      Number.isInteger(parsedPort) &&
      parsedPort > 0;
    if (portRaw && !isValidPort) {
      throw new Error("MINIO_PORT 必须为正整数");
    }

    return new MinioAdapter({
      endPoint,
      port: parsedPort,
      useSSL: parseBoolean(process.env.MINIO_USE_SSL, true),
      bucket,
      accessKey,
      secretKey,
      sessionToken: process.env.MINIO_SESSION_TOKEN || undefined,
      region: process.env.MINIO_REGION || undefined,
      publicBaseUrl: process.env.MINIO_PUBLIC_BASE_URL || undefined,
      keyPrefix: process.env.MINIO_KEY_PREFIX || undefined,
    });
  }

  if (driver !== "oss") {
    throw new Error(`不支持的存储驱动: ${driver}`);
  }

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
