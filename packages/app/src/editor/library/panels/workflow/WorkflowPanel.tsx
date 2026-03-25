import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createWorkflow,
  deleteWorkflow,
  getWorkflow,
  getWorkflowList,
  updateWorkflow,
  type WorkflowDetail,
  type WorkflowListItem,
  type WorkflowUpsertPayload,
} from "@/api/workflowApi";
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
  const [selectedWorkflowDetail, setSelectedWorkflowDetail] =
    useState<WorkflowDetail | null>(null);
  const [workflowSearch, setWorkflowSearch] = useState("");
  const [workflowStatusFilter, setWorkflowStatusFilter] = useState<
    (typeof WORKFLOW_STATUS_FILTERS)[number]["id"]
  >("all");
  const [workflowList, setWorkflowList] = useState<WorkflowListItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingWorkflowId, setLoadingWorkflowId] = useState<string | null>(null);
  const [isSavingWorkflow, setIsSavingWorkflow] = useState(false);
  const [deletingWorkflowId, setDeletingWorkflowId] = useState<string | null>(
    null
  );
  const listRequestIdRef = useRef(0);
  const detailRequestIdRef = useRef(0);
  const listAbortControllerRef = useRef<AbortController | null>(null);
  const detailAbortControllerRef = useRef<AbortController | null>(null);

  const refreshWorkflowList = useCallback(async () => {
    const requestId = ++listRequestIdRef.current;
    listAbortControllerRef.current?.abort();
    const controller = new AbortController();
    listAbortControllerRef.current = controller;
    setIsLoading(true);
    setLoadError(null);
    try {
      const items = await getWorkflowList({
        search: workflowSearch,
        status: workflowStatusFilter,
        signal: controller.signal,
      });
      if (requestId !== listRequestIdRef.current) return [];
      setWorkflowList(items);
      return items;
    } catch (error) {
      if (requestId !== listRequestIdRef.current) return [];
      if (error instanceof DOMException && error.name === "AbortError") {
        return [];
      }
      setWorkflowList([]);
      setLoadError(error instanceof Error ? error.message : "加载工作流失败");
      return [];
    } finally {
      if (requestId === listRequestIdRef.current) {
        setIsLoading(false);
      }
    }
  }, [workflowSearch, workflowStatusFilter]);

  useEffect(() => {
    void refreshWorkflowList();
  }, [refreshWorkflowList]);

  useEffect(
    () => () => {
      listAbortControllerRef.current?.abort();
      detailAbortControllerRef.current?.abort();
    },
    []
  );

  const resetDialogState = useCallback(() => {
    setWorkflowOpen(false);
    setSelectedWorkflowId(null);
    setSelectedWorkflowDetail(null);
  }, []);

  const selectedWorkflowName = useMemo(
    () =>
      selectedWorkflowDetail?.name ??
      workflowList.find((item) => item.id === selectedWorkflowId)?.name ??
      "该工作流",
    [selectedWorkflowDetail?.name, selectedWorkflowId, workflowList]
  );
  const dialogInitialWorkflow = useMemo(
    () =>
      selectedWorkflowDetail
        ? {
            name: selectedWorkflowDetail.name,
            nodes: selectedWorkflowDetail.nodes,
            edges: selectedWorkflowDetail.edges,
          }
        : undefined,
    [selectedWorkflowDetail]
  );

  const handleCreateWorkflow = useCallback(() => {
    if (isSavingWorkflow || deletingWorkflowId || loadingWorkflowId) return;
    setSelectedWorkflowId(null);
    setSelectedWorkflowDetail(null);
    setWorkflowOpen(true);
  }, [deletingWorkflowId, isSavingWorkflow, loadingWorkflowId]);

  const handleOpenWorkflow = useCallback(
    async (workflowId: string) => {
      if (
        loadingWorkflowId === workflowId ||
        isSavingWorkflow ||
        deletingWorkflowId === workflowId
      ) {
        return;
      }

      const requestId = ++detailRequestIdRef.current;
      detailAbortControllerRef.current?.abort();
      const controller = new AbortController();
      detailAbortControllerRef.current = controller;
      setLoadingWorkflowId(workflowId);
      setLoadError(null);
      try {
        const detail = await getWorkflow(workflowId, { signal: controller.signal });
        if (requestId !== detailRequestIdRef.current) return;
        setSelectedWorkflowId(workflowId);
        setSelectedWorkflowDetail(detail);
        setWorkflowOpen(true);
      } catch (error) {
        if (requestId !== detailRequestIdRef.current) return;
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
        setLoadError(error instanceof Error ? error.message : "加载工作流失败");
      } finally {
        if (requestId === detailRequestIdRef.current) {
          setLoadingWorkflowId((current) =>
            current === workflowId ? null : current
          );
        }
      }
    },
    [deletingWorkflowId, isSavingWorkflow, loadingWorkflowId]
  );

  const handleSaveWorkflow = useCallback(
    async (payload: WorkflowUpsertPayload) => {
      if (isSavingWorkflow || deletingWorkflowId) return;

      setIsSavingWorkflow(true);
      try {
        const workflow = selectedWorkflowId
          ? await updateWorkflow(selectedWorkflowId, payload)
          : await createWorkflow(payload);

        setSelectedWorkflowId(workflow.id);
        setSelectedWorkflowDetail(workflow);
        await refreshWorkflowList();
        setWorkflowOpen(false);
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : "保存工作流失败");
      } finally {
        setIsSavingWorkflow(false);
      }
    },
    [deletingWorkflowId, isSavingWorkflow, refreshWorkflowList, selectedWorkflowId]
  );

  const handleDeleteWorkflow = useCallback(async () => {
    if (
      !selectedWorkflowId ||
      deletingWorkflowId === selectedWorkflowId ||
      isSavingWorkflow
    ) {
      return;
    }

    setDeletingWorkflowId(selectedWorkflowId);
    try {
      await deleteWorkflow(selectedWorkflowId);
      await refreshWorkflowList();
      resetDialogState();
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "删除工作流失败");
    } finally {
      setDeletingWorkflowId((current) =>
        current === selectedWorkflowId ? null : current
      );
    }
  }, [
    deletingWorkflowId,
    isSavingWorkflow,
    refreshWorkflowList,
    resetDialogState,
    selectedWorkflowId,
  ]);

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
          onClick={handleCreateWorkflow}
          aria-label="新建工作流"
          title="新建工作流"
          disabled={isSavingWorkflow || Boolean(loadingWorkflowId)}
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
          workflowList.map((item) => {
            const isOpening = loadingWorkflowId === item.id;
            const isDeleting = deletingWorkflowId === item.id;
            return (
              <button
                key={item.id}
                type="button"
                className="workflow-panel__item"
                onClick={() => void handleOpenWorkflow(item.id)}
                disabled={isOpening || isDeleting || isSavingWorkflow}
              >
                <div className="workflow-panel__item-main">
                  <div className="workflow-panel__item-title">{item.name}</div>
                  <div className="workflow-panel__item-meta">
                    <span>{item.nodeCount} 个节点</span>
                    <span>
                      {isOpening ? "正在加载..." : `最近执行：${item.lastRun}`}
                    </span>
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
            );
          })
        ) : (
          <div className="workflow-panel__empty">
            未找到匹配的工作流，试试更换筛选或搜索关键词。
          </div>
        )}
      </div>

      <WorkflowGenDialog
        open={workflowOpen}
        onOpenChange={(open) => {
          if (isSavingWorkflow || deletingWorkflowId) return;
          if (open) {
            setWorkflowOpen(true);
            return;
          }
          resetDialogState();
        }}
        onDeleteWorkflow={selectedWorkflowId ? handleDeleteWorkflow : undefined}
        deletingWorkflow={deletingWorkflowId === selectedWorkflowId}
        savingWorkflow={isSavingWorkflow}
        workflowName={selectedWorkflowId ? selectedWorkflowName : undefined}
        initialWorkflow={dialogInitialWorkflow}
        onSave={(payload) => void handleSaveWorkflow(payload)}
      />
    </div>
  );
}
