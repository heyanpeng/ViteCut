# ViteCut API - 后端服务（Node.js + FFmpeg）
# 
# 本 Dockerfile 包含两阶段构建：
# 1. 依赖安装与构建阶段（builder）
# 2. 精简运行阶段（runtime）
# 
# 注意：使用 vitecut-base:latest 作为基础镜像
# 基础镜像从 GitHub Container Registry (GHCR) 拉取
# 镜像地址：ghcr.io/<你的用户名>/vitecut-base:latest
# 基础镜像已包含 Node.js、FFmpeg、字体等工具

# 基础镜像地址（可通过 build-arg 覆盖）
ARG BASE_IMAGE=vitecut-base:latest

########################################################
# 1. 依赖安装与构建阶段（Builder）                     #
########################################################
# 使用基础镜像（已包含 FFmpeg、字体等）
FROM ${BASE_IMAGE} AS builder

# 启用 corepack 并激活 pnpm
# 说明：pnpm 已在基础镜像中按固定版本预装，这里不再重复执行以避免构建时联网

# 工作目录已在基础镜像中设置为 /app，这里不需要重复设置

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
# 使用基础镜像（已包含 FFmpeg、字体等）
FROM ${BASE_IMAGE} AS runtime

# 环境变量
ENV FFMPEG_PATH=/usr/bin/ffmpeg
ENV NODE_ENV=production

# 工作目录已在基础镜像中设置为 /app，这里不需要重复设置

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