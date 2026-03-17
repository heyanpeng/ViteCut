# Postprocess Service

Python 后处理服务（标准库 HTTP 服务 + FFmpeg），用于导出完成后的二次处理（当前支持倍速）。

## API

- `GET /healthz`
- `POST /speed`

请求示例：

```json
{
  "input_path": "/app/packages/api/output/input.mp4",
  "output_path": "/app/packages/api/output/input.speed.1.5x.mp4",
  "speed": 1.5
}
```

## Docker

在仓库根目录执行：

```bash
docker compose build vitecut-postprocess
docker compose up -d vitecut-postprocess
```

该服务通过 `MEDIA_ROOT` 限制可访问路径，默认仅允许处理 `/app/packages/api/output` 下文件。
服务监听端口可通过环境变量 `PORT` 覆盖（默认 `8010`）。

## 本地命令行启动

在仓库根目录执行：

```bash
pnpm dev:postprocess
```

或在当前目录执行：

```bash
pnpm dev
```

说明：本地命令行脚本使用 `python app.py`（标准库 HTTP 服务）启动，避免部分 macOS + Python 环境下 ASGI 服务器的 `_multiprocessing` 导入问题。
