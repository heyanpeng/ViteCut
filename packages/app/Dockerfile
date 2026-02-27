# =================================================================
# ViteCut 前端 Dockerfile
# 用于多阶段构建：首先使用 Node 构建前端资源，然后用 Nginx 部署静态文件并代理 API
# =================================================================

# ---------- 构建阶段：使用 Node 和 pnpm 构建前端资源 ----------
FROM node:20-alpine AS builder             # 使用 Node 20 Alpine 镜像，加速并减小镜像体积

RUN corepack enable && corepack prepare pnpm@latest --activate   # 启用 pnpm 作为包管理器

WORKDIR /app                                # 设置工作目录到 /app

# 拷贝基础依赖声明文件
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
# 拷贝所有 packages 子目录
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile          # 安装依赖，确保与 lockfile 一致
RUN pnpm --filter app build                 # 仅构建 app 包（前端主应用）

# ---------- 运行阶段：使用 Nginx 作为容器入口 ----------
FROM nginx:alpine                          # 生产镜像基于 Nginx

# 拷贝构建输出到 Nginx 默认静态目录
COPY --from=builder /app/packages/app/dist /usr/share/nginx/html

# 拷贝自定义 Nginx 配置，实现 SPA 路由回退与 API 代理
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80                                  # 暴露 80 端口（HTTP 服务入口）

# 启动 Nginx 以服务静态内容及代理 API
CMD ["nginx", "-g", "daemon off;"]
