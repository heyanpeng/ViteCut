import mysql from "mysql2/promise";

// 创建 MySQL 连接池（全局唯一，供项目中查询复用）
const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "localhost", // MySQL 主机名
  port: Number(process.env.MYSQL_PORT) || 3306, // MySQL 端口
  user: process.env.MYSQL_USER ?? "root", // MySQL 用户名
  password: process.env.MYSQL_PASSWORD ?? "", // MySQL 密码
  database: process.env.MYSQL_DATABASE ?? "vitecut", // 默认数据库名
  waitForConnections: true, // 等待连接池可用
  connectionLimit: 10, // 最大连接数
  queueLimit: 0, // 队列连接数量（0 = 不限）
});

export { pool as db };

/**
 * 数据库初始化函数
 * - 若数据库不存在则创建数据库
 * - 按需创建 users、media、tasks 三个表
 * - 建立常用索引（若已存在自动忽略错误）
 */
export async function initDb(): Promise<void> {
  const dbName = process.env.MYSQL_DATABASE ?? "vitecut";
  // 创建临时连接池——用于查询创建数据库，不指定 database
  const tempPool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    waitForConnections: true,
    connectionLimit: 1,
  });
  try {
    // 创建数据库（若不存在）
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err: unknown) {
    // 权限错误时，给出中文提示并抛出
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
    // 关闭临时连接池
    await tempPool.end();
  }

  // 建表：users 用户信息表
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id VARCHAR(36) PRIMARY KEY,
      username VARCHAR(64) NOT NULL,
      password_hash VARCHAR(255) NOT NULL,
      created_at BIGINT NOT NULL,
      UNIQUE KEY uk_users_username (username)
    )
  `);

  // 建表：media 素材信息表（含通用元数据和归属用户）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('video', 'image', 'audio') NOT NULL,
      added_at BIGINT NOT NULL,           -- 添加时间（时间戳 ms）
      url TEXT NOT NULL,                  -- 访问地址
      filename VARCHAR(255) NOT NULL,     -- 原始文件名
      duration DOUBLE NULL,               -- 时长（秒），可空
      cover_url TEXT NULL,                -- 封面图地址，可空
      source VARCHAR(32) NOT NULL DEFAULT 'user',  -- 来源标识
      user_id VARCHAR(36) NULL            -- 归属用户 id，可空
    )
  `);

  // 建表：tasks 任务信息表（任务执行队列/审计）
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id VARCHAR(64) PRIMARY KEY,
      user_id VARCHAR(36) NOT NULL,        -- 用户 id
      type VARCHAR(32) NOT NULL,           -- 任务类型
      status VARCHAR(16) NOT NULL,         -- 任务状态
      label VARCHAR(512) NOT NULL,         -- 任务简要描述
      progress INT NULL,                   -- 进度（百分比），可空
      message TEXT NULL,                   -- 错误消息或附加说明
      results TEXT NULL,                   -- 结果数据(JSON)
      created_at BIGINT NOT NULL,          -- 创建时间
      updated_at BIGINT NOT NULL           -- 更新时间
    )
  `);

  // 创建常用索引（MySQL 不支持 IF NOT EXISTS，若重复自动忽略错误）
  await pool
    .query("CREATE INDEX idx_media_type ON media(type)")
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_media_added_at ON media(added_at)")
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_media_user_id ON media(user_id)")
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_tasks_user_id ON tasks(user_id)")
    .catch(() => {});
  await pool
    .query("CREATE INDEX idx_tasks_updated_at ON tasks(updated_at)")
    .catch(() => {});
}
