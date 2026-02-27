#!/bin/bash
# 本地构建镜像并导出，供云服务器加载
# 用法: ./scripts/deploy-image.sh
# 或带参数自动上传: ./scripts/deploy-image.sh root@你的IP:/opt/vitecut

set -e
IMAGE="vitecut-api:latest"
TAR="vitecut-api.tar"

echo "1. 本地构建镜像..."
docker compose build vitecut-api

echo "2. 导出为 $TAR ..."
docker save -o "$TAR" "$IMAGE"

if [ -n "$1" ]; then
  echo "3. 上传到服务器..."
  scp "$TAR" "$1/"
  echo "   完成。SSH 登录后执行: cd /opt/vitecut && docker load -i $TAR && docker compose up -d"
else
  echo "3. 完成。下一步："
  echo "   scp $TAR root@你的ECS:/opt/vitecut/"
  echo "   ssh 登录 ECS 后: cd /opt/vitecut && docker load -i $TAR && docker compose up -d"
fi
