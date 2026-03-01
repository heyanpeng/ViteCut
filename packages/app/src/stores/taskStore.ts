import { create } from "zustand";

/** 任务状态类型 */
export type TaskStatus = "pending" | "running" | "success" | "failed";

/** 任务类型定义 */
export type TaskType =
  | "export" // 导出任务
  | "ai-image" // AI 图片生成
  | "ai-video" // AI 视频生成
  | "ai-audio" // AI 音频生成
  | "ai-tts" // AI 文本转语音
  | "other"; // 其它类型

/**
 * 本地任务对象结构
 */
export interface Task {
  id: string; // 任务唯一标识
  type: TaskType; // 任务类型
  status: TaskStatus; // 当前状态
  label: string; // 任务标签（描述）
  progress?: number; // 0-100 进度, 一般 running 时可选
  message?: string; // 错误或成功提示信息
  resultUrl?: string; // 任务结果，如生成文件的URL
  createdAt: number; // 创建时间戳
  updatedAt: number; // 最后更新时间戳
}

/**
 * 服务端任务 SSE 推送 payload（字段与后端保持一致，驼峰风格）
 */
export interface ServerTaskPayload {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  progress?: number;
  message?: string;
  results?: Array<{ url: string; record?: unknown }>; // 结果以数组形式返回，通常取第一个；record 为媒体记录，成功时用于通知库面板
  createdAt: number;
  updatedAt: number;
}

/**
 * 任务 Store 接口，定义所有可用操作
 */
interface TaskStore {
  tasks: Task[]; // 当前所有任务列表

  /**
   * 本地添加新任务，自动分配 id/createdAt/updatedAt
   * @param task 任务描述（不含 id、时间戳）
   * @returns 新任务的 id
   */
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => string;

  /**
   * 添加由服务端创建的任务（已有 id）
   * @param task 完整任务对象，与后端对接
   */
  addServerTask: (task: Task) => void;

  /**
   * 应用服务端 SSE 推送的任务更新
   * 若本地已存在则更新，否则添加到列表头部
   * @param payload 服务端推送的任务信息
   */
  applyServerTaskUpdate: (payload: ServerTaskPayload) => void;

  /**
   * 用后端返回的完整列表覆盖本地任务（如首次加载或刷新）
   * @param payload 服务端任务列表
   */
  setTasksFromServer: (payload: ServerTaskPayload[]) => void;

  /**
   * 局部更新单个任务（如状态、进度、结果等字段）
   * @param id 任务 id
   * @param update 要更新的任务字段
   */
  updateTask: (
    id: string,
    update: Partial<
      Pick<Task, "status" | "progress" | "message" | "resultUrl" | "label">
    >
  ) => void;

  /**
   * 移除单个任务
   * @param id 任务 id
   */
  removeTask: (id: string) => void;

  /**
   * 清除已完成任务，仅保留 running/pending 状态
   */
  clearCompleted: () => void;
}

/**
 * 生成全局唯一 task id（带有时间戳和 7 位随机后缀）
 */
function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * useTaskStore - 任务全局状态管理
 * - 基于 zustand，面向本地和服务端（SSE）都能正确同步
 * - 提供任务的增、删、查、改等操作
 */
export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],

  /**
   * 添加本地新任务到队列尾部，返回生成的 id
   */
  addTask: (task) => {
    const id = generateId();
    const now = Date.now();
    set((state) => ({
      tasks: [
        ...state.tasks,
        {
          ...task,
          id,
          createdAt: now,
          updatedAt: now,
        },
      ],
    }));
    return id;
  },

  /**
   * 添加服务端返回的任务到队列头部（避免与本地任务 id 冲突）
   */
  addServerTask: (task) => {
    set((state) => ({
      tasks: [task, ...state.tasks],
    }));
  },

  /**
   * 使用服务端推送 task 更新本地任务
   * - 若本地已有该 id，则合并最新字段并更新时间（updatedAt）
   * - 若没有，则前置插入列表
   */
  applyServerTaskUpdate: (payload) => {
    // 转为本地 Task 结构（取 results[0]?.url 作为 resultUrl）
    const task: Task = {
      id: payload.id,
      type: payload.type,
      status: payload.status,
      label: payload.label,
      progress: payload.progress,
      message: payload.message,
      resultUrl: payload.results?.[0]?.url,
      createdAt: payload.createdAt,
      updatedAt: payload.updatedAt,
    };
    set((state) => {
      const exists = state.tasks.some((t) => t.id === payload.id);
      if (exists) {
        // 更新已有任务
        return {
          tasks: state.tasks.map((t) =>
            t.id === payload.id
              ? { ...t, ...task, updatedAt: payload.updatedAt }
              : t
          ),
        };
      }
      // 不存在则先头插入
      return { tasks: [task, ...state.tasks] };
    });
  },

  /**
   * 用服务端给定的任务数组覆盖本地任务
   * （如首次加载、页面刷新或队列同步）
   */
  setTasksFromServer: (payloads) => {
    // 转换所有 payload 为 Task
    const tasks: Task[] = payloads.map((p) => ({
      id: p.id,
      type: p.type,
      status: p.status,
      label: p.label,
      progress: p.progress,
      message: p.message,
      resultUrl: p.results?.[0]?.url,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));
    set({ tasks });
  },

  /**
   * 更新指定任务字段（例如状态、进度、结果 URL，自动更新时间）
   */
  updateTask: (id, update) => {
    const now = Date.now();
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...update, updatedAt: now } : t
      ),
    }));
  },

  /**
   * 删除指定任务（通常用于用户主动移除）
   */
  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  /**
   * 清除所有已完成任务（success/failed），仅保留运行中或待处理任务
   */
  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status === "running" || t.status === "pending"
      ),
    }));
  },
}));
