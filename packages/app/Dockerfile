# ViteCut 前端 - 多阶段构建镜像，极致瘦身与部署优化
# 阶段一：Node 环境下构建前端产物（Builder 阶段）
# 阶段二：Nginx 镜像中部署静态资源，暴露 3000 端口用于服务外部访问

# -- 阶段一：构建产物 --
FROM node:20-alpine AS builder

# 全局安装 pnpm 包管理器，用于高速安装依赖
RUN npm install -g pnpm

# 设置工作目录为 /app
WORKDIR /app

# 预先拷贝根目录下主配置文件，利于构建缓存
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./

# 拷贝所有 monorepo 下 packages 目录（包含前端 app 及工作区依赖）
COPY packages/ ./packages/

# Vite 构建时需的 API KEY，通过 Docker build 的 build-arg 传递（用于图片/声音 API 拉取）
ARG VITE_PEXELS_API_KEY
ENV VITE_PEXELS_API_KEY=$VITE_PEXELS_API_KEY

ARG VITE_FREESOUND_API_KEY
ENV VITE_FREESOUND_API_KEY=$VITE_FREESOUND_API_KEY

# 安装所有依赖，--frozen-lockfile 保证锁文件精确一致
RUN pnpm install --frozen-lockfile

# 构建 ViteCut 前端及其依赖的 workspace 包（app... 表示 app + 依赖）
# 确保底层包已先被编译
RUN pnpm --filter "app..." run build

# -- 阶段二：Nginx 托管静态资源 --
FROM nginx:alpine

# 复制打包生成的静态文件至 Nginx 默认站点目录
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

# 覆盖默认 Nginx 配置，实现前端 history 路由、缓存优化等
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 Nginx 80 端口为 3000（便于本地或服务器通过 3000 访问）
EXPOSE 3000

# 启动 Nginx 进程，-g "daemon off;" 保持前台运行，不自动退出
CMD ["nginx", "-g", "daemon off;"]
