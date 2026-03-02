# ViteCut API - 后端服务（Node.js + FFmpeg）
# 
# 本 Dockerfile 包含两阶段构建，分别为“依赖安装与构建阶段（builder）”和“精简运行阶段”。

########################################################
# 1. 依赖安装与构建阶段（Builder）                     #
########################################################
FROM node:20-alpine AS builder

# 启用 corepack 并激活 pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# 设置工作目录
WORKDIR /app

# Step 1: 拷贝依赖安装所需的主配置文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Step 2: 分别复制各包的 package.json 以利用缓存
COPY packages/api/package.json ./packages/api/
COPY packages/@vitecut/project/package.json ./packages/@vitecut/project/
COPY packages/@vitecut/storage/package.json ./packages/@vitecut/storage/

# Step 3: 安装依赖（忽略 scripts 以避免 ffmpeg-static 等意外下载）
RUN pnpm install --frozen-lockfile --ignore-scripts

# Step 4: 复制源码（此时才复制代码，防止代码变动导致依赖重新安装）
COPY packages/api ./packages/api
COPY packages/@vitecut/project ./packages/@vitecut/project
COPY packages/@vitecut/storage ./packages/@vitecut/storage

# Step 5: 按依赖关系顺序编译
RUN pnpm --filter @vitecut/project build
RUN pnpm --filter @vitecut/storage build
RUN pnpm --filter api build

########################################################
# 2. 运行阶段（仅含运行所需内容，极致瘦身）             #
########################################################
FROM node:20-alpine

# 1. 设置镜像源为阿里云并安装 FFmpeg
# 注意：将此步骤放在 COPY 之前，利用 Docker 缓存。只要基础镜像不换，以后构建都会秒过。
RUN sed -i 's/dl-cdn.alpinelinux.org/mirrors.aliyun.com/g' /etc/apk/repositories && \
    apk add --no-cache ffmpeg

# 环境变量
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV NODE_ENV=production

# 设置运行时工作目录
WORKDIR /app

# 2. 从 builder 阶段复制运行所需的产物
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/@vitecut/storage/package.json ./packages/@vitecut/storage/
COPY --from=builder /app/packages/@vitecut/storage/dist ./packages/@vitecut/storage/dist
COPY --from=builder /app/package.json ./

# 创建后端输出目录
RUN mkdir -p /app/packages/api/output

# 切换到 API 实际启动目录
WORKDIR /app/packages/api

# 暴露端口
EXPOSE 3001

# 容器启动命令
CMD ["node", "dist/index.js"]