import type { Task } from "./taskRepository.js";

/** SSE 发送函数：向连接写入一条 SSE 消息 */
export type SendFunction = (data: string) => void;

/** 按用户维护的 SSE 连接订阅表 */
const subscriptions = new Map<string, Set<SendFunction>>();

/**
 * 订阅任务更新事件
 * @param userId 用户 id
 * @param send 发送函数，用于向该连接写入 SSE 消息
 * @returns 取消订阅函数
 */
export function subscribe(userId: string, send: SendFunction): () => void {
  if (!subscriptions.has(userId)) {
    subscriptions.set(userId, new Set());
  }
  const userSubs = subscriptions.get(userId)!;
  userSubs.add(send);

  return () => {
    userSubs.delete(send);
    if (userSubs.size === 0) {
      subscriptions.delete(userId);
    }
  };
}

/**
 * 向指定用户的所有已连接客户端广播任务更新
 * @param userId 用户 id
 * @param task 任务对象（驼峰，与 API 响应一致）
 */
export function broadcastTaskUpdate(userId: string, task: Task): void {
  const userSubs = subscriptions.get(userId);
  if (!userSubs || userSubs.size === 0) return;

  const data = JSON.stringify(task);
  const message = `event: task-update\ndata: ${data}\n\n`;

  for (const send of userSubs) {
    try {
      send(message);
    } catch (err) {
      // 连接可能已断开，忽略错误
      console.error("[taskEvents] Failed to send to subscriber:", err);
    }
  }
}
