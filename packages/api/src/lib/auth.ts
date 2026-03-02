import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "./db.js";

// 密码加密盐轮数
const SALT_ROUNDS = 10;

/**
 * 对用户密码进行哈希加密，返回加密后的字符串
 * @param password 明文密码
 * @returns 加密后的密码字符串
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 校验明文密码与加密hash是否一致
 * @param password 明文密码
 * @param hash 已存储的密码hash
 * @returns true表示密码正确，false表示错误
 */
export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * 用户数据结构
 */
export interface User {
  id: string; // 用户唯一ID
  username: string; // 用户名
  passwordHash: string; // 加密后的密码(hash)
  createdAt: number; // 创建时间戳(ms)
}

/**
 * 数据库行转User对象
 * @param row 数据库返回对象
 * @returns User对象
 */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    createdAt: Number(row.created_at),
  };
}

/**
 * 创建新用户（已传入加密密码）
 * @param username 用户名
 * @param passwordHash 已加密的密码
 * @returns 新建User对象
 */
export async function createUser(
  username: string,
  passwordHash: string
): Promise<User> {
  const id = randomUUID(); // 生成唯一ID
  const createdAt = Date.now(); // 当前时间戳
  await db.query(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
    [id, username, passwordHash, createdAt]
  );
  return { id, username, passwordHash, createdAt };
}

/**
 * 根据用户名查找用户
 * @param username 用户名
 * @returns User对象或null
 */
export async function findByUsername(username: string): Promise<User | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  const row = rows?.[0];
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

/**
 * 根据ID查找用户
 * @param id 用户ID
 * @returns User对象或null
 */
export async function findById(id: string): Promise<User | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

/**
 * 若用户表为空则创建默认管理员（用于本地/演示环境）
 * 默认用户名密码可通过环境变量覆盖
 */
export async function ensureDefaultUser(): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM users LIMIT 1");
  if (rows && rows.length > 0) return; // 已存在用户无需处理
  const username = process.env.DEFAULT_ADMIN_USERNAME ?? "demo";
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "123456";
  const hash = await hashPassword(password);
  await createUser(username, hash);
}
