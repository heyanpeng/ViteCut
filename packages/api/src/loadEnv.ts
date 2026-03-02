import { config } from "dotenv";
import { existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

// 获取当前文件（loadEnv.ts）所在目录，向上 3 层获得 monorepo 根目录
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "../../..");

// 判断当前是否为生产环境（NODE_ENV=production 时为生产环境）
const isProd = process.env.NODE_ENV === "production";

// 打印当前 NODE_ENV 和 monorepo 根目录，便于调试
console.log(`[loadEnv] 当前 NODE_ENV = ${process.env.NODE_ENV}`);
console.log(`[loadEnv] monorepo 根目录 = ${root}`);

// 首先加载根目录下的 .env 文件（优先级最低）
const envFiles = [resolve(root, ".env")];

if (!isProd) {
  // 非生产环境下，尝试加载 .env.development 文件（如存在则加入覆盖）
  const dev = resolve(root, ".env.development");
  if (existsSync(dev)) {
    envFiles.push(dev);
  } else {
    console.log("[loadEnv] 未找到 .env.development，跳过加载");
  }
  // 非生产环境下，尝试加载 .env.local 文件（如存在则加入覆盖）
  const local = resolve(root, ".env.local");
  if (existsSync(local)) {
    envFiles.push(local);
  } else {
    console.log("[loadEnv] 未找到 .env.local，跳过加载");
  }
}

// 按顺序加载所有 env 文件，后加载的会覆盖前面的同名变量（override: true）
// 例如：.env < .env.development < .env.local
console.log(`[loadEnv] 按顺序加载以下 env 文件：\n${envFiles.join("\n")}`);
for (let i = 0; i < envFiles.length; i++) {
  // .env 文件（第一个）override: false，后续 override: true，确保优先级较高的 env 能覆盖前面加载的变量
  config({ path: envFiles[i], override: i > 0 });
  console.log(`[loadEnv] 已加载: ${envFiles[i]}`);
}
