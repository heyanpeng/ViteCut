# ViteCut API - 后端服务（Node.js + FFmpeg）
#
# 本 Dockerfile 包含两阶段构建，分别为“依赖安装与构建阶段（builder）”和“精简运行阶段”。
# 每一步都有详细注释，便于理解整个构建流程及优化点。

########################################################
# 1. 依赖安装与构建阶段（Builder）                     #
########################################################
FROM node:20-alpine AS builder

# 启用 corepack 并激活 pnpm，避免全局安装，加快依赖管理
RUN corepack enable && corepack prepare pnpm@latest --activate

# 设置工作目录
WORKDIR /app

# Step 1: 拷贝依赖安装所需的主配置文件到容器中（提升缓存复用效率）
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# Step 2: 分别复制 api 及其依赖的 workspace 包的 package.json
# 这样可以更早发挥 Docker 缓存优势，若依赖未变则跳过重新安装
COPY packages/api/package.json ./packages/api/
COPY packages/@vitecut/project/package.json ./packages/@vitecut/project/
COPY packages/@vitecut/storage/package.json ./packages/@vitecut/storage/

# Step 3: 复制源码（需在依赖 install 后再复制代码，提升构建效率）
COPY packages/api ./packages/api
COPY packages/@vitecut/project ./packages/@vitecut/project
COPY packages/@vitecut/storage ./packages/@vitecut/storage

# Step 4: 安装依赖，但跳过所有 postinstall 脚本（例如 ffmpeg-static），加快安装速度，避免意外或超时
RUN pnpm install --frozen-lockfile --ignore-scripts

# Step 5: 按依赖关系顺序，分别编译 project、storage 和 api
# 这样可以确保底层包已编译好再编译上层依赖
RUN pnpm --filter @vitecut/project build
RUN pnpm --filter @vitecut/storage build
RUN pnpm --filter api build

########################################################
# 2. 运行阶段（仅含运行所需内容，极致瘦身）             #
########################################################
FROM node:20-alpine

# 更换 Alpine 镜像源至清华源，避免国内拉取镜像缓慢或失败
RUN sed -i 's/dl-cdn.alpine.org/mirrors.tuna.tsinghua.edu.cn/g' /etc/apk/repositories

# 安装运行时依赖，仅安装 ffmpeg 二进制（跳过 ffmpeg-static，减小镜像体积和构建时间）
RUN apk add --no-cache ffmpeg

# 环境变量，指定真实 ffmpeg 可执行文件路径
ENV FFMPEG_PATH=/usr/bin/ffmpeg

# 设置运行时工作目录为 /app
WORKDIR /app

# 只从 builder 阶段复制运行所需的 node_modules、dist 产物和 package.json
# 保证镜像体积最小化且启动最迅速
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/api/package.json ./packages/api/
COPY --from=builder /app/packages/api/node_modules ./packages/api/node_modules
COPY --from=builder /app/packages/api/dist ./packages/api/dist
COPY --from=builder /app/packages/@vitecut/storage/package.json ./packages/@vitecut/storage/
COPY --from=builder /app/packages/@vitecut/storage/dist ./packages/@vitecut/storage/dist
COPY --from=builder /app/package.json ./

# 创建后端输出目录（如用于保存导出视频等临时文件）
RUN mkdir -p /app/packages/api/output

# 标记生产环境
ENV NODE_ENV=production

# 切换到 API 实际启动目录
WORKDIR /app/packages/api

# 暴露后端服务 API 端口（默认 3001）
EXPOSE 3001

# 容器启动命令，执行编译后的主入口（dist/index.js）
CMD ["node", "dist/index.js"]
