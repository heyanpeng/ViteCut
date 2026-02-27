# ViteCut API - 后端服务（Node + FFmpeg）
# 构建阶段
FROM node:20-alpine AS builder

# 安装 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

WORKDIR /app

# 复制 monorepo 根配置
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# 复制 api 及其依赖的 workspace 包
COPY packages/api/package.json ./packages/api/
COPY packages/@vitecut/project/package.json ./packages/@vitecut/project/
# 复制源码
COPY packages/api ./packages/api
COPY packages/@vitecut/project ./packages/@vitecut/project

# 安装依赖并构建
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @vitecut/project build
RUN pnpm --filter api build

# 运行阶段（ffmpeg-static 已包含 FFmpeg 二进制，无需 apt 安装）
FROM node:20-alpine

WORKDIR /app

# 只复制运行时所需（API 不依赖 @vitecut/project 运行时）
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/package.json ./

# 创建数据目录
RUN mkdir -p /app/packages/api/uploads /app/packages/api/output /app/packages/api/data

ENV NODE_ENV=production
WORKDIR /app/packages/api

EXPOSE 3001

CMD ["node", "dist/index.js"]
