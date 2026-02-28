import jwt from "jsonwebtoken";

const SECRET = process.env.JWT_SECRET || "vitecut-dev-secret-change-in-production";
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || "7d";

if (process.env.NODE_ENV === "production" && !process.env.JWT_SECRET) {
  throw new Error("生产环境必须设置 JWT_SECRET");
}

export interface JwtPayload {
  userId: string;
  username: string;
  iat?: number;
  exp?: number;
}

export function signToken(payload: Omit<JwtPayload, "iat" | "exp">): string {
  return jwt.sign(
    payload as object,
    SECRET,
    { expiresIn: EXPIRES_IN as jwt.SignOptions["expiresIn"] }
  );
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, SECRET) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}
