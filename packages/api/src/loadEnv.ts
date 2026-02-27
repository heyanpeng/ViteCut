import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const cwd = process.cwd();
const isProd = process.env.NODE_ENV === "production";

// 加载顺序（后者覆盖前者）
// 线下：.env.development -> .env -> .env.example
// 线上：.env.production -> .env（生产多用系统环境变量，可不用文件）
config({ path: resolve(cwd, ".env") });
if (isProd) {
  const prod = resolve(cwd, ".env.production");
  if (existsSync(prod)) config({ path: prod });
} else {
  const dev = resolve(cwd, ".env.development");
  const fallback = existsSync(dev) ? dev : resolve(cwd, ".env.example");
  config({ path: fallback });
}
// 本地覆盖，不提交 git
const local = resolve(cwd, ".env.local");
if (existsSync(local)) config({ path: local });
