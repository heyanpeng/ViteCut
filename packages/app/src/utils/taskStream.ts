/**
 * 订阅任务 SSE 流，收到 task-update 时同步到 taskStore
 * 使用 fetch + 流式读取（以便带 Authorization 头）
 */

import { getAuthHeaders } from "@/contexts";
import { useTaskStore } from "@/stores/taskStore";
import type { ServerTaskPayload } from "@/stores/taskStore";
import { notifyMediaAdded } from "@/utils/mediaNotifications";
import type { MediaRecord } from "@/api/mediaApi";

const STREAM_URL = "/api/tasks/stream";

/**
 * 解析 SSE 消息（按 \n\n 分段后取 event 与 data）
 * data 取整段「data: 」之后到消息末尾，避免 label/message 中含换行时 JSON 被截断
 */
function parseSSEMessages(raw: string): Array<{ event: string; data: string }> {
  const events: Array<{ event: string; data: string }> = [];
  const messages = raw.split(/\n\n/).filter(Boolean);
  for (const msg of messages) {
    let event = "message";
    const firstLine = msg.split(/\r?\n/)[0];
    if (firstLine?.startsWith("event:")) {
      event = firstLine.slice(6).trim();
    }
    const dataPrefix = "data: ";
    const dataIdx = msg.indexOf(dataPrefix);
    if (dataIdx !== -1) {
      const data = msg.slice(dataIdx + dataPrefix.length).trimEnd();
      events.push({ event, data });
    }
  }
  return events;
}

function processBuffer(
  buffer: string,
  apply: (payload: ServerTaskPayload) => void,
  onTaskUpdate?: (payload: ServerTaskPayload) => void
): void {
  for (const { event, data } of parseSSEMessages(buffer)) {
    if (event === "task-update") {
      try {
        const payload = JSON.parse(data) as ServerTaskPayload;
        apply(payload);
        onTaskUpdate?.(payload);
        if (payload.status === "success" && payload.results?.[0]?.record) {
          notifyMediaAdded(payload.results[0].record as MediaRecord);
        }
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

export function subscribeTaskStream(
  onTaskUpdate?: (payload: ServerTaskPayload) => void
): () => void {
  const headers = getAuthHeaders();
  if (!headers.Authorization) return () => {};

  const controller = new AbortController();
  let buffer = "";

  fetch(STREAM_URL, {
    signal: controller.signal,
    credentials: "include",
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
            }, onTaskUpdate);
          }
          if (done && buffer) {
            processBuffer(buffer, (payload) => {
              useTaskStore.getState().applyServerTaskUpdate(payload);
            }, onTaskUpdate);
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
