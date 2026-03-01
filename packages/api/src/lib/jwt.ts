import jwt from "jsonwebtoken";

// JWT 密钥，优先使用环境变量，开发环境有默认值（生产务必更换）
const SECRET =
  process.env.JWT_SECRET || "vitecut-dev-secret-change-in-production";
// Token 过期时间，支持如 "7d" 等格式，支持通过环境变量调整
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

// 生产环境必须明确设置 JWT_SECRET，以确保安全
if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("生产环境必须设置 JWT_SECRET");
}

// JWT 载荷定义
export interface JwtPayload {
  userId: string; // 用户唯一ID
  username: string; // 用户名
  iat?: number; // token 签发时间（可选，由 jwt 自动添加）
  exp?: number; // token 过期时间（可选，由 jwt 自动添加）
}

// 签发 JWT token，自动带过期时间。不包含 iat/exp 字段，由 jwt 库生成
export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(payload as object, SECRET, {
    expiresIn: EXPIRES_IN as jwt.SignOptions["expiresIn"],
  });
}

// 校验 JWT token，验证通过返回 payload，失败返回 null
export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
