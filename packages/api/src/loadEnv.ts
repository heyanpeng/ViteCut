import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// monorepo 根目录（loadEnv 在 packages/api/src/ 下，向上 3 层）
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

// 判断生产环境
const isProd = process.env.NODE_ENV === "production";

console.log(`[loadEnv] 当前 NODE_ENV = ${process.env.NODE_ENV}`);
console.log(`[loadEnv] monorepo 根目录 = ${root}`);

const envFiles = [resolve(root, ".env")];

if (!isProd) {
  const dev = resolve(root, ".env.development");
  if (existsSync(dev)) {
    envFiles.push(dev);
  } else {
    console.log("[loadEnv] 未找到 .env.development，跳过加载");
  }
  const local = resolve(root, ".env.local");
  if (existsSync(local)) {
    envFiles.push(local);
  } else {
    console.log("[loadEnv] 未找到 .env.local，跳过加载");
  }
}

console.log(`[loadEnv] 按顺序加载以下 env 文件：\n${envFiles.join("\n")}`);
for (let i = 0; i < envFiles.length; i++) {
  // 后续文件需 override，否则不会覆盖 .env 中已有的变量（如 MYSQL_HOST）
  config({ path: envFiles[i], override: i > 0 });
  console.log(`[loadEnv] 已加载: ${envFiles[i]}`);
}
