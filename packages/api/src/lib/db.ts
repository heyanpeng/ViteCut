import mysql from "mysql2/promise";

const pool = mysql.createPool({
  host: process.env.MYSQL_HOST ?? "localhost",
  port: Number(process.env.MYSQL_PORT) || 3306,
  user: process.env.MYSQL_USER ?? "root",
  password: process.env.MYSQL_PASSWORD ?? "",
  database: process.env.MYSQL_DATABASE ?? "vitecut",
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

export { pool as db };

export async function initDb(): Promise<void> {
  const dbName = process.env.MYSQL_DATABASE ?? "vitecut";
  const tempPool = mysql.createPool({
    host: process.env.MYSQL_HOST ?? "localhost",
    port: Number(process.env.MYSQL_PORT) || 3306,
    user: process.env.MYSQL_USER ?? "root",
    password: process.env.MYSQL_PASSWORD ?? "",
    waitForConnections: true,
    connectionLimit: 1,
  });
  try {
    await tempPool.query(`CREATE DATABASE IF NOT EXISTS \`${dbName}\``);
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code;
    if (code === "ER_DBACCESS_DENIED_ERROR" || code === "ER_ACCESS_DENIED_ERROR") {
      throw new Error(
        `无权限创建数据库 "${dbName}"，请手动在 MySQL 中执行：CREATE DATABASE IF NOT EXISTS \`${dbName}\`; 或使用有 CREATE 权限的账号`
      );
    }
    throw err;
  } finally {
    await tempPool.end();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS media (
      id VARCHAR(36) PRIMARY KEY,
      name VARCHAR(255) NOT NULL,
      type ENUM('video', 'image', 'audio') NOT NULL,
      added_at BIGINT NOT NULL,
      url TEXT NOT NULL,
      filename VARCHAR(255) NOT NULL,
      duration DOUBLE NULL,
      cover_url TEXT NULL,
      source VARCHAR(32) NOT NULL DEFAULT 'user'
    )
  `);

  // 创建索引（MySQL 不支持 IF NOT EXISTS，忽略已存在错误）
  await pool.query("CREATE INDEX idx_media_type ON media(type)").catch(() => {});
  await pool.query("CREATE INDEX idx_media_added_at ON media(added_at)").catch(() => {});
}
