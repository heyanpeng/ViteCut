# ViteCut 前端 - 多阶段构建
# 阶段一：Node 构建；阶段二：Nginx 运行

FROM node:20-alpine AS builder

RUN npm install -g pnpm

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

# Vite 构建时变量，从 .env 通过 build-arg 传入
ARG VITE_PEXELS_API_KEY
ENV VITE_PEXELS_API_KEY=$VITE_PEXELS_API_KEY

ARG VITE_FREESOUND_API_KEY
ENV VITE_FREESOUND_API_KEY=$VITE_FREESOUND_API_KEY

RUN pnpm install --frozen-lockfile
# 先构建 app 的所有依赖，再构建 app（app... = app + 其依赖）
RUN pnpm --filter "app..." run build

FROM nginx:alpine

COPY --from=builder /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 3000

CMD ["nginx", "-g", "daemon off;"]
