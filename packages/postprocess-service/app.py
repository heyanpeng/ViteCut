from __future__ import annotations

import json
import os
import shlex
import subprocess
from dataclasses import dataclass
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.parse import urlparse


def get_media_root() -> Path:
    root = os.getenv("MEDIA_ROOT", "/app/packages/api/output")
    return Path(root).resolve()


MEDIA_ROOT = get_media_root()


@dataclass
class SpeedRequest:
    input_path: str
    output_path: str
    speed: float


def _ensure_under_media_root(path: Path) -> None:
    resolved = path.resolve()
    if MEDIA_ROOT not in resolved.parents and resolved != MEDIA_ROOT:
        raise ValueError("path must be under MEDIA_ROOT")


def _build_atempo_chain(speed: float) -> str:
    # FFmpeg atempo 单段仅支持 [0.5, 2.0]，超范围需串联。
    parts: list[str] = []
    s = speed
    while s > 2.0:
        parts.append("2.0")
        s /= 2.0
    while s < 0.5:
        parts.append("0.5")
        s /= 0.5
    parts.append(f"{s:.6f}")
    return ",".join(f"atempo={item}" for item in parts)


def _parse_speed_request(raw: bytes) -> SpeedRequest:
    try:
        payload = json.loads(raw.decode("utf-8"))
    except Exception as exc:
        raise ValueError("invalid json body") from exc

    if not isinstance(payload, dict):
        raise ValueError("invalid json body")

    input_path = payload.get("input_path")
    output_path = payload.get("output_path")
    speed = payload.get("speed")

    if not isinstance(input_path, str) or not input_path.strip():
        raise ValueError("input_path is required")
    if not isinstance(output_path, str) or not output_path.strip():
        raise ValueError("output_path is required")
    if not isinstance(speed, (int, float)):
        raise ValueError("speed must be a number")
    speed = float(speed)
    if not (0.0 < speed <= 4.0):
        raise ValueError("speed must be in (0, 4]")

    return SpeedRequest(
        input_path=input_path.strip(),
        output_path=output_path.strip(),
        speed=speed,
    )


def _process_speed(req: SpeedRequest) -> dict[str, Any]:
    input_path = Path(req.input_path)
    output_path = Path(req.output_path)

    _ensure_under_media_root(input_path)
    _ensure_under_media_root(output_path)

    if not input_path.exists():
        raise FileNotFoundError("input file not found")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    if output_path.exists():
        output_path.unlink()

    video_filter = f"setpts=PTS/{req.speed}"
    audio_filter = _build_atempo_chain(req.speed)

    cmd = [
        "ffmpeg",
        "-y",
        "-i",
        str(input_path),
        "-filter:v",
        video_filter,
        "-filter:a",
        audio_filter,
        "-c:v",
        "libx264",
        "-c:a",
        "aac",
        str(output_path),
    ]

    result = subprocess.run(cmd, capture_output=True, text=True)
    if result.returncode != 0:
        detail = result.stderr[-2000:] or "ffmpeg failed"
        raise RuntimeError(detail)

    return {
        "status": "ok",
        "output_path": str(output_path),
        "speed": req.speed,
        "command": " ".join(shlex.quote(part) for part in cmd),
    }


class Handler(BaseHTTPRequestHandler):
    server_version = "vitecut-postprocess/0.1"

    def _send_json(self, status: int, payload: dict[str, Any]) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path == "/healthz":
            self._send_json(200, {"status": "ok"})
            return
        self._send_json(404, {"error": "not found"})

    def do_POST(self) -> None:  # noqa: N802
        path = urlparse(self.path).path
        if path != "/speed":
            self._send_json(404, {"error": "not found"})
            return

        length_raw = self.headers.get("Content-Length")
        try:
            length = int(length_raw) if length_raw is not None else 0
        except ValueError:
            self._send_json(400, {"error": "invalid Content-Length"})
            return
        raw = self.rfile.read(length)

        try:
            req = _parse_speed_request(raw)
            result = _process_speed(req)
            self._send_json(200, result)
        except ValueError as exc:
            self._send_json(400, {"error": str(exc)})
        except FileNotFoundError as exc:
            self._send_json(400, {"error": str(exc)})
        except Exception as exc:
            self._send_json(500, {"error": str(exc)})

    def log_message(self, format: str, *args: Any) -> None:  # noqa: A003
        # 保持输出简洁，沿用默认 stderr 输出格式
        super().log_message(format, *args)


def main() -> None:
    port = int(os.getenv("POSTPROCESS_SERVICE_PORT", os.getenv("PORT", "8010")))
    host = os.getenv("POSTPROCESS_SERVICE_HOST", "0.0.0.0")
    server = ThreadingHTTPServer((host, port), Handler)
    print(f"[postprocess-service] MEDIA_ROOT={MEDIA_ROOT}")
    print(f"[postprocess-service] listening on http://{host}:{port}")
    server.serve_forever()


if __name__ == "__main__":
    main()
