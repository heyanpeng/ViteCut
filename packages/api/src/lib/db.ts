import mysql from "mysql2/promise";

// 创建 MySQL 连接池（全局唯一，供整个项目复用，提高连接效率）
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "localhost", // MySQL 主机名（默认本地）
  port: Number(process.env.MYSQL_PORT) || 3306, // MySQL 端口（默认3306）
  user: process.env.MYSQL_USER ?? "root", // MySQL 用户（默认root）
  password: process.env.MYSQL_PASSWORD ?? "", // MySQL 密码
  database: process.env.MYSQL_DATABASE ?? "vitecut", // 默认数据库名（vitecut）
  waitForConnections: true, // 请求高峰时，等待连接池有可用连接
  connectionLimit: 10, // 最大连接数，防止连接过多撑爆数据库
  queueLimit: 0, // 超过最大连接后等待队列数量，0为不限制
});

// 导出pool为 db（统一项目中数据库访问写法）
export { pool as db };

/**
 * 数据库初始化函数（一般项目启动时调用，仅需调用一次）
 * 包括：
 * 1. 若目标数据库不存在则自动创建数据库
 * 2. 自动建表：users、media、tasks 三个核心表
 * 3. 自动创建常用索引，加速常用查询（如类型/用户/更新时间等）
 */
export async function initDb(): Promise<void> {
  const dbName = process.env.MYSQL_DATABASE ?? "vitecut";
  // 创建一个仅用于初始化的临时连接池（不指定database，部分MySQL不允许数据库不存在时指定database）
  const tempPool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    waitForConnections: true,
    connectionLimit: 1,
  });
  try {
    // 如果目标数据库不存在则自动创建
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err: unknown) {
    // 典型的数据库无权限报错专门给出提示（便于开发者排查）
    const code = (err as { code?: string })?.code;
    if (
      code === "ER_DBACCESS_DENIED_ERROR" ||
      code === "ER_ACCESS_DENIED_ERROR"
    ) {
      throw new Error(
        `无权限创建数据库 "${dbName}"，请手动在 MySQL 中执行：CREATE DATABASE IF NOT EXISTS \`${dbName}\`; 或使用有 CREATE 权限的账号`
      );
    }
    throw err;
  } finally {
    // 永远释放掉临时连接池，避免连接泄漏
    await tempPool.end();
  }

  // 建表结构定义如下：
  // users 用户信息表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,                   -- 用户唯一ID（UUID）
      username VARCHAR(64) NOT NULL,                -- 用户名
      password_hash VARCHAR(255) NOT NULL,          -- 加密后密码
      created_at BIGINT NOT NULL,                   -- 创建时间（毫秒时间戳）
      UNIQUE KEY uk_users_username (username)       -- 用户名唯一索引
    )
  `);

  // media 媒体素材信息表（支持多媒体元数据、用户归属）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(36) PRIMARY KEY,                           -- 素材唯一ID（UUID）
      name VARCHAR(255) NOT NULL,                           -- 媒体名称
      type ENUM('video', 'image', 'audio') NOT NULL,        -- 媒体类型
      added_at BIGINT NOT NULL,                             -- 添加时间（ms）
      url TEXT NOT NULL,                                    -- 访问地址
      filename VARCHAR(255) NOT NULL,                       -- 存储对象名
      duration DOUBLE NULL,                                 -- 时长（秒，音视频用）
      cover_url TEXT NULL,                                  -- 封面图片url（可空）
      meta_json JSON NULL,                                  -- 媒体扩展元信息（图片/视频/音频）
      source VARCHAR(32) NOT NULL DEFAULT 'user',           -- 素材来源（user/ai/system等）
      user_id VARCHAR(36) NULL                              -- 归属用户ID，可空
    )
  `);

  // tasks 任务信息表（通用异步任务，支持进度监控/审计/结果储存等）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(64) PRIMARY KEY,                -- 任务唯一ID
      user_id VARCHAR(36) NOT NULL,              -- 关联用户ID
      type VARCHAR(32) NOT NULL,                 -- 任务类型
      status VARCHAR(16) NOT NULL,               -- 当前状态
      label VARCHAR(512) NOT NULL,               -- 任务简述
      progress INT NULL,                         -- 进度（百分比）
      message TEXT NULL,                         -- 错误消息/运行日志
      results TEXT NULL,                         -- 任务结果(JSON)
      created_at BIGINT NOT NULL,                -- 创建时间（ms）
      updated_at BIGINT NOT NULL                 -- 最后更新时间（ms）
    )
  `);

  // 创建常用索引（MySQL 不支持 IF NOT EXISTS，所以catch忽略重复错误即可）
  // 加快常见筛选条件查询：媒体类型、媒体添加时间、媒体归属用户、任务归属用户、任务更新时间
  await pool
    .query("CREATE INDEX idx_media_type ON media(type)") // type索引（查找视频/音频/图片等）
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_media_added_at ON media(added_at)") // 按时间倒序查询媒体
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_media_user_id ON media(user_id)") // 用户自己的媒体
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_tasks_user_id ON tasks(user_id)") // 用户相关的任务
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_tasks_updated_at ON tasks(updated_at)") // 按更新时间查任务
    .catch(() => {});
}
