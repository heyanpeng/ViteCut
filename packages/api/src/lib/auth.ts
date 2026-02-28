import bcrypt from "bcrypt";
import { randomUUID } from "node:crypto";
import type { RowDataPacket } from "mysql2";
import { db } from "./db.js";

const SALT_ROUNDS = 10;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(
  password: string,
  hash: string
): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export interface User {
  id: string;
  username: string;
  passwordHash: string;
  createdAt: number;
}

function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row.id as string,
    username: row.username as string,
    passwordHash: row.password_hash as string,
    createdAt: Number(row.created_at),
  };
}

export async function createUser(
  username: string,
  passwordHash: string
): Promise<User> {
  const id = randomUUID();
  const createdAt = Date.now();
  await db.query(
    "INSERT INTO users (id, username, password_hash, created_at) VALUES (?, ?, ?, ?)",
    [id, username, passwordHash, createdAt]
  );
  return { id, username, passwordHash, createdAt };
}

export async function findByUsername(username: string): Promise<User | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE username = ?",
    [username]
  );
  const row = rows?.[0];
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

export async function findById(id: string): Promise<User | null> {
  const [rows] = await db.query<RowDataPacket[]>(
    "SELECT * FROM users WHERE id = ?",
    [id]
  );
  const row = rows?.[0];
  return row ? rowToUser(row as Record<string, unknown>) : null;
}

/** 若用户表为空则创建默认管理员（用于本地/演示），可通过环境变量覆盖 */
export async function ensureDefaultUser(): Promise<void> {
  const [rows] = await db.query<RowDataPacket[]>("SELECT 1 FROM users LIMIT 1");
  if (rows && rows.length > 0) return;
  const username = process.env.DEFAULT_ADMIN_USERNAME ?? "demo";
  const password = process.env.DEFAULT_ADMIN_PASSWORD ?? "123456";
  const hash = await hashPassword(password);
  await createUser(username, hash);
}
