/**
 * 订阅任务 SSE 流，收到 task-update 时同步到 taskStore
 * 使用 fetch + 流式读取（以便带 Authorization 头）
 */

import { getAuthHeaders } from "@/contexts";
import { useTaskStore } from "@/stores/taskStore";
import type { ServerTaskPayload } from "@/stores/taskStore";

const STREAM_URL = "/api/tasks/stream";

function parseSSEMessages(raw: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  let event = "";
  let data = "";
  for (const line of raw.split(/\r?\n/)) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      data = line.slice(5).trim();
    } else if (line === "") {
      if (event || data) {
        events.push({ event: event || "message", data });
        event = "";
        data = "";
      }
    }
  }
  return events;
}

function processBuffer(
  buffer: string,
  apply: (payload: ServerTaskPayload) => void
): void {
  for (const { event, data } of parseSSEMessages(buffer)) {
    if (event === "task-update") {
      try {
        const payload = JSON.parse(data) as ServerTaskPayload;
        apply(payload);
        if (import.meta.env.DEV) {
          console.debug(
            "[taskStream] task-update:",
            payload.id,
            payload.status,
            payload.progress
          );
        }
      } catch {
        // ignore parse error
      }
    }
  }
}

export function subscribeTaskStream(): () => void {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return () => {};

  const controller = new AbortController();
  let buffer = "";

  fetch(STREAM_URL, {
    signal: controller.signal,
    headers: { ...headers },
  })
    .then((res) => {
      if (!res.ok || !res.body) {
        if (import.meta.env.DEV && !res.ok) {
          console.warn(
            "[taskStream] Stream failed:",
            res.status,
            res.statusText
          );
        }
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const read = (): Promise<void> =>
        reader.read().then(({ done, value }) => {
          if (value?.length) {
            buffer += decoder.decode(value, { stream: !done });
          }
          const parts = buffer.split(/\n\n/);
          buffer = done ? "" : (parts.pop() ?? "");
          const complete = parts.join("\n\n");
          if (complete) {
            processBuffer(complete, (payload) => {
              useTaskStore.getState().applyServerTaskUpdate(payload);
            });
          }
          if (done && buffer) {
            processBuffer(buffer, (payload) => {
              useTaskStore.getState().applyServerTaskUpdate(payload);
            });
          }
          if (done) return;
          return read();
        });
      return read();
    })
    .catch((err) => {
      if (import.meta.env.DEV) {
        console.warn("[taskStream] Stream error:", err);
      }
    });

  return () => controller.abort();
}
