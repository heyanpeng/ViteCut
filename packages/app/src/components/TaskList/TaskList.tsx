import { useState, useEffect } from "react";
import { Popover } from "@radix-ui/themes";
import {
  ListTodo,
  Loader2,
  CheckCircle2,
  XCircle,
  Upload,
  Image,
  Video,
  Music,
  Mic2,
  Sparkles,
  X,
} from "lucide-react";
import { useTaskStore, type Task, type TaskType } from "@/stores/taskStore";
import { getTasks, deleteTask } from "@/api/tasksApi";
import { useToast } from "@/components/Toaster";
import { Tooltip } from "@/components/Tooltip";
import "./TaskList.css";

type StatusFilter = "all" | "active" | "completed";

/** 格式化任务时间，类微信：今天=时分，昨天=昨天 时分，其他=月日 时分 */
function formatTaskTime(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const targetDate = new Date(d.getFullYear(), d.getMonth(), d.getDate());

  const pad = (n: number) => String(n).padStart(2, "0");
  const hh = pad(d.getHours());
  const mm = pad(d.getMinutes());

  if (targetDate.getTime() === today.getTime()) {
    return `${hh}:${mm}`;
  }
  if (targetDate.getTime() === yesterday.getTime()) {
    return `昨天 ${hh}:${mm}`;
  }
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}月${day}日 ${hh}:${mm}`;
}

const TASK_TYPE_CONFIG: Record<
  TaskType,
  { label: string; icon: React.ReactNode }
> = {
  export: { label: "导出", icon: <Upload size={14} /> },
  "ai-image": { label: "AI 生图", icon: <Image size={14} /> },
  "ai-video": { label: "AI 生视频", icon: <Video size={14} /> },
  "ai-audio": { label: "AI 音频", icon: <Music size={14} /> },
  "ai-tts": { label: "AI 语音", icon: <Mic2 size={14} /> },
  other: { label: "任务", icon: <Sparkles size={14} /> },
};

function TaskItem({
  task,
  onRemove,
}: {
  task: Task;
  onRemove: () => void;
}) {
  const config = TASK_TYPE_CONFIG[task.type];

  return (
    <div
      className={`task-list__item task-list__item--${task.status}`}
      data-status={task.status}
    >
      <div className="task-list__item-icon">{config.icon}</div>
      <div className="task-list__item-body">
        <div className="task-list__item-row">
          {task.resultUrl && task.status === "success" ? (
            <div
              role="button"
              tabIndex={0}
              className="task-list__item-label task-list__item-label--link"
              onClick={() => window.open(task.resultUrl, "_blank")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  window.open(task.resultUrl, "_blank");
                }
              }}
            >
              {task.label}
            </div>
          ) : (
            <div className="task-list__item-label">{task.label}</div>
          )}
          <span className="task-list__item-time">
            {formatTaskTime(task.createdAt)}
          </span>
        </div>
        {task.status === "running" && task.progress != null && (
          <div className="task-list__item-progress">
            <div
              className="task-list__item-progress-bar"
              style={{ width: `${task.progress}%` }}
            />
          </div>
        )}
        {task.message && (
          <div
            className={`task-list__item-message task-list__item-message--${task.status}`}
          >
            {task.message}
          </div>
        )}
      </div>
      <div className="task-list__item-status">
        {task.status === "running" || task.status === "pending" ? (
          <Loader2 size={14} className="task-list__item-spinner" />
        ) : task.status === "success" ? (
          <CheckCircle2 size={14} className="task-list__item-success" />
        ) : task.status === "failed" ? (
          <XCircle size={14} className="task-list__item-error" />
        ) : null}
      </div>
      <button
        type="button"
        className="task-list__item-remove"
        aria-label="移除"
        onClick={(e) => {
          e.stopPropagation();
          onRemove();
        }}
      >
        <X size={12} />
      </button>
    </div>
  );
}

export function TaskList() {
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const { showToast } = useToast();
  const tasks = useTaskStore((s) => s.tasks);
  const setTasksFromServer = useTaskStore((s) => s.setTasksFromServer);
  const removeTask = useTaskStore((s) => s.removeTask);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);

  const handleRemoveTask = async (taskId: string) => {
    try {
      await deleteTask(taskId);
      removeTask(taskId);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "删除失败";
      showToast(msg, "error");
    }
  };

  // 挂载时拉取任务列表，仅在异步回调中更新 loading（避免 effect 内同步 setState）
  useEffect(() => {
    getTasks({ page: 1, limit: 50 })
      .then((res) => setTasksFromServer(res.items))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [setTasksFromServer]);

  const activeCount = tasks.filter(
    (t) => t.status === "running" || t.status === "pending"
  ).length;
  const completedCount = tasks.filter(
    (t) => t.status === "success" || t.status === "failed"
  ).length;

  // 按状态筛选
  const filteredTasks =
    statusFilter === "active"
      ? tasks.filter(
          (t) => t.status === "running" || t.status === "pending"
        )
      : statusFilter === "completed"
        ? tasks.filter(
            (t) => t.status === "success" || t.status === "failed"
          )
        : tasks;

  // 统一按创建时间倒序（最新任务在前）
  const sortedTasks = [...filteredTasks].sort((a, b) => b.createdAt - a.createdAt);

  return (
    <Popover.Root>
      <Tooltip content="任务列表">
        <Popover.Trigger>
          <button
            type="button"
            className="app-editor-layout__header-btn task-list__trigger"
            aria-label="任务列表"
          >
            <ListTodo size={16} />
            {activeCount > 0 && (
              <span className="task-list__badge">{activeCount}</span>
            )}
          </button>
        </Popover.Trigger>
      </Tooltip>
      <Popover.Content
        width="420px"
        className="task-list__popover"
        align="end"
        sideOffset={8}
      >
        <div className="task-list__header">
          <div className="task-list__header-actions">
            <div className="task-list__tabs">
              {(
                [
                  { value: "all" as const, label: "全部", count: tasks.length },
                  {
                    value: "active" as const,
                    label: "进行中",
                    count: activeCount,
                  },
                  {
                    value: "completed" as const,
                    label: "已完成",
                    count: completedCount,
                  },
                ] as const
              ).map(({ value, label, count }) => (
                <button
                  key={value}
                  type="button"
                  className={`task-list__tab ${
                    statusFilter === value ? "task-list__tab--active" : ""
                  }`}
                  onClick={() => setStatusFilter(value)}
                >
                  {label}
                  <span className="task-list__tab-badge">{count}</span>
                </button>
              ))}
            </div>
            {completedCount > 0 && (
              <button
                type="button"
                className="task-list__clear"
                onClick={clearCompleted}
              >
                清空已完成
              </button>
            )}
          </div>
        </div>
        <div className="task-list__body">
          {loading ? (
            <div className="task-list__loading">
              <Loader2 size={20} className="task-list__loading-spinner" />
              <span>加载中…</span>
            </div>
          ) : sortedTasks.length === 0 ? (
            <div className="task-list__empty">暂无任务</div>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onRemove={() => handleRemoveTask(task.id)}
              />
            ))
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
