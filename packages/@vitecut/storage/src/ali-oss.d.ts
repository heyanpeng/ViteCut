declare module "ali-oss" {
  /**
   * OSS 初始化参数
   */
  export interface OSSOptions {
    /** OSS 所在地域，例如 'oss-cn-hangzhou' */
    region: string;
    /** OSS 存储空间名（Bucket Name） */
    bucket: string;
    /** 阿里云 Access Key ID */
    accessKeyId: string;
    /** 阿里云 Access Key Secret */
    accessKeySecret: string;
    /** 使用 STS 临时授权时的 Token（可选） */
    stsToken?: string;
    /** 自定义 endpoint（可选） */
    endpoint?: string;
    /** 是否使用内网访问（可选） */
    internal?: boolean;
    /** 是否使用 HTTPS 协议（可选） */
    secure?: boolean;
    /** 超时时间，支持字符串或数字（可选） */
    timeout?: string | number;
  }

  /**
   * 上传对象的参数
   */
  export interface PutOptions {
    /** 请求头（可选），如 Content-Type、x-oss-meta-* 等 */
    headers?: Record<string, string>;
  }

  /**
   * 获取签名 URL 的参数
   */
  export interface SignatureUrlOptions {
    /** HTTP 方法，默认为 GET（可选） */
    method?: string;
    /** URL 过期时间，单位为秒（可选） */
    expires?: number;
    /** 用于签名的请求头（可选） */
    headers?: Record<string, string>;
  }

  /**
   * OSS 客户端类
   */
  export default class OSS {
    /**
     * 构造函数，初始化 OSS 客户端
     * @param options OSSOptions 初始化参数
     */
    constructor(options: OSSOptions);

    /**
     * 上传对象
     * @param name 对象名（object key）
     * @param file 待上传的数据，可以为 Uint8Array 或本地文件路径字符串
     * @param options 上传参数（可选）
     * @returns Promise
     */
    put(
      name: string,
      file: Uint8Array | string,
      options?: PutOptions
    ): Promise<unknown>;

    /**
     * 删除对象
     * @param name 对象名（object key）
     * @returns Promise
     */
    delete(name: string): Promise<unknown>;

    /**
     * 下载对象
     * @param name 对象名（object key）
     * @returns Promise，包含 content 字段
     */
    get(name: string): Promise<{ content: Uint8Array | string }>;

    /**
     * 获取签名后的对象访问 URL
     * @param name 对象名（object key）
     * @param options 签名参数（可选）
     * @returns Promise，签名 URL 字符串
     */
    signatureUrl(name: string, options?: SignatureUrlOptions): Promise<string>;
  }
}
