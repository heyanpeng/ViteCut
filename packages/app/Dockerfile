# ViteCut 前端 - 多阶段构建
# 阶段一：Node 构建；阶段二：Nginx 运行

FROM node:20-alpine AS builder

RUN npm install -g pnpm yarn

WORKDIR /app

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY packages/ ./packages/

RUN pnpm install --frozen-lockfile
# 先构建 app 的所有依赖，再构建 app（app... = app + 其依赖）
RUN pnpm --filter "app..." run build

FROM nginx:alpine

COPY --from=builder /app/packages/app/dist /usr/share/nginx/html
COPY packages/app/nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
