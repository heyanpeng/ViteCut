import { useState } from "react";
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
import { Tooltip } from "@/components/Tooltip";
import "./TaskList.css";

type StatusFilter = "all" | "active" | "completed";

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
        {task.status === "running" && task.progress != null && (
          <div className="task-list__item-progress">
            <div
              className="task-list__item-progress-bar"
              style={{ width: `${task.progress}%` }}
            />
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
  const tasks = useTaskStore((s) => s.tasks);
  const removeTask = useTaskStore((s) => s.removeTask);
  const clearCompleted = useTaskStore((s) => s.clearCompleted);

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

  // 按状态分组：进行中在前，然后按时间倒序
  const sortedTasks = [...filteredTasks].sort((a, b) => {
    const order = { running: 0, pending: 1, success: 2, failed: 3 };
    const diff = order[a.status] - order[b.status];
    if (diff !== 0) return diff;
    return b.createdAt - a.createdAt;
  });

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
          {sortedTasks.length === 0 ? (
            <div className="task-list__empty">暂无任务</div>
          ) : (
            sortedTasks.map((task) => (
              <TaskItem
                key={task.id}
                task={task}
                onRemove={() => removeTask(task.id)}
              />
            ))
          )}
        </div>
      </Popover.Content>
    </Popover.Root>
  );
}
