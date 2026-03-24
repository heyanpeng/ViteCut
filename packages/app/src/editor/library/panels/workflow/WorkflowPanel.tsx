import { useCallback, useEffect, useState } from "react";
import { deleteWorkflow, getWorkflowList } from "@/api/workflowApi";
import { Plus, Search } from "lucide-react";
import { WorkflowGenDialog } from "@/editor/library/panels/ai/WorkflowGenDialog";
import "./WorkflowPanel.css";

const WORKFLOW_STATUS_FILTERS = [
  { id: "all", label: "全部" },
  { id: "running", label: "运行中" },
  { id: "idle", label: "空闲" },
  { id: "failed", label: "异常" },
] as const;


export function WorkflowPanel() {
  const [workflowOpen, setWorkflowOpen] = useState(false);
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(
    null
  );
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<
    (typeof WORKFLOW_STATUS_FILTERS)[number]["id"]
  >("all");
  const [workflowList, setWorkflowList] = useState<
    Awaited<ReturnType<typeof getWorkflowList>>
  >([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(
    null
  );
  const selectedWorkflowName =
    workflowList.find((item) => item.id === selectedWorkflowId)?.name ?? "该工作流";

  useEffect(() => {
    let active = true;
    setIsLoading(true);
    setLoadError(null);
    getWorkflowList({
      search: workflowSearch,
      status: workflowStatusFilter,
    })
      .then((items) => {
        if (!active) return;
        setWorkflowList(items);
      })
      .catch((err) => {
        if (!active) return;
        setWorkflowList([]);
        setLoadError(err instanceof Error ? err.message : "加载工作流失败");
      })
      .finally(() => {
        if (!active) return;
        setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, [workflowSearch, workflowStatusFilter]);

  const handleDeleteWorkflow = useCallback(async () => {
    if (!selectedWorkflowId || deletingWorkflowId === selectedWorkflowId) return;
    setDeletingWorkflowId(selectedWorkflowId);
    try {
      await deleteWorkflow(selectedWorkflowId);
      setWorkflowList((prev) =>
        prev.filter((item) => item.id !== selectedWorkflowId)
      );
      setWorkflowOpen(false);
      setSelectedWorkflowId(null);
    } finally {
      setDeletingWorkflowId((current) =>
        current === selectedWorkflowId ? null : current
      );
    }
  }, [deletingWorkflowId, selectedWorkflowId]);

  return (
    <div className="workflow-panel">
      <div className="workflow-panel__toolbar">
        <div className="workflow-panel__search">
          <Search size={16} className="workflow-panel__search-icon" />
          <input
            type="text"
            className="workflow-panel__search-input"
            value={workflowSearch}
            onChange={(event) => setWorkflowSearch(event.target.value)}
            placeholder="搜索工作流名称"
            aria-label="搜索工作流名称"
          />
        </div>
        <button
          type="button"
          className="workflow-panel__create-btn"
          onClick={() => {
            setSelectedWorkflowId(null);
            setWorkflowOpen(true);
          }}
          aria-label="新建工作流"
          title="新建工作流"
        >
          <Plus size={16} />
        </button>
      </div>

      <div className="workflow-panel__filters">
        {WORKFLOW_STATUS_FILTERS.map((item) => (
          <button
            key={item.id}
            type="button"
            className={`workflow-panel__filter-btn ${
              workflowStatusFilter === item.id
                ? "workflow-panel__filter-btn--active"
                : ""
            }`}
            onClick={() => setWorkflowStatusFilter(item.id)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="workflow-panel__list">
        {isLoading ? (
          <div className="workflow-panel__empty">正在加载工作流...</div>
        ) : loadError ? (
          <div className="workflow-panel__empty">{loadError}</div>
        ) : workflowList.length > 0 ? (
          workflowList.map((item) => (
            <button
              key={item.id}
              type="button"
              className="workflow-panel__item"
              onClick={() => {
                setSelectedWorkflowId(item.id);
                setWorkflowOpen(true);
              }}
            >
                <div className="workflow-panel__item-main">
                  <div className="workflow-panel__item-title">{item.name}</div>
                  <div className="workflow-panel__item-meta">
                    <span>{item.nodeCount} 个节点</span>
                    <span>最近执行：{item.lastRun}</span>
                  </div>
                </div>
                <span
                  className={`workflow-panel__status workflow-panel__status--${item.status}`}
                >
                  {item.status === "running"
                    ? "运行中"
                    : item.status === "failed"
                      ? "异常"
                      : "空闲"}
                </span>
              </button>
          ))
        ) : (
          <div className="workflow-panel__empty">
            未找到匹配的工作流，试试更换筛选或搜索关键词。
          </div>
        )}
      </div>

      <WorkflowGenDialog
        open={workflowOpen}
        onOpenChange={(open) => {
          setWorkflowOpen(open);
          if (!open) {
            setSelectedWorkflowId(null);
          }
        }}
        onDeleteWorkflow={selectedWorkflowId ? handleDeleteWorkflow : undefined}
        deletingWorkflow={deletingWorkflowId === selectedWorkflowId}
        workflowName={selectedWorkflowId ? selectedWorkflowName : undefined}
      />
    </div>
  );
}
