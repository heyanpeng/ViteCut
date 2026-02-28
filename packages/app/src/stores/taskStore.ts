import { create } from "zustand";

/** 任务状态 */
export type TaskStatus = "pending" | "running" | "success" | "failed";

/** 任务类型 */
export type TaskType =
  | "export"
  | "ai-image"
  | "ai-video"
  | "ai-audio"
  | "ai-tts"
  | "other";

export interface Task {
  id: string;
  type: TaskType;
  status: TaskStatus;
  label: string;
  /** 0-100 进度，running 时可选 */
  progress?: number;
  /** 失败或成功时的消息 */
  message?: string;
  /** 成功时的结果 URL 等 */
  resultUrl?: string;
  createdAt: number;
  updatedAt: number;
}

interface TaskStore {
  tasks: Task[];
  addTask: (task: Omit<Task, "id" | "createdAt" | "updatedAt">) => string;
  updateTask: (
    id: string,
    update: Partial<Pick<Task, "status" | "progress" | "message" | "resultUrl" | "label">>
  ) => void;
  removeTask: (id: string) => void;
  clearCompleted: () => void;
}

function generateId(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export const useTaskStore = create<TaskStore>((set) => ({
  tasks: [],

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

  updateTask: (id, update) => {
    const now = Date.now();
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === id ? { ...t, ...update, updatedAt: now } : t
      ),
    }));
  },

  removeTask: (id) => {
    set((state) => ({
      tasks: state.tasks.filter((t) => t.id !== id),
    }));
  },

  clearCompleted: () => {
    set((state) => ({
      tasks: state.tasks.filter(
        (t) => t.status === "running" || t.status === "pending"
      ),
    }));
  },
}));
