import { useEffect, useState } from "react";
import { AlertDialog, Dialog } from "radix-ui";
import { WorkflowComposer } from "@vitecut/workflow";

export function WorkflowGenDialog({
  open,
  onOpenChange,
  onDeleteWorkflow,
  deletingWorkflow = false,
  workflowName,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDeleteWorkflow?: () => void;
  deletingWorkflow?: boolean;
  workflowName?: string;
}) {
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  useEffect(() => {
    if (!open || !onDeleteWorkflow) {
      setDeleteConfirmOpen(false);
    }
  }, [onDeleteWorkflow, open]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="ai-workflow-dialog__overlay" />
        <Dialog.Content
          className="ai-workflow-dialog__content"
          onOpenAutoFocus={(event) => event.preventDefault()}
        >
          <Dialog.Title className="ai-workflow-dialog__sr-only">
            工作流生成
          </Dialog.Title>
          <Dialog.Description className="ai-workflow-dialog__sr-only">
            工作流生成弹窗，包含节点库、全屏画布和属性面板。
          </Dialog.Description>
          <div className="ai-workflow-dialog__body">
            <WorkflowComposer
              onExit={() => onOpenChange(false)}
              onDeleteWorkflow={
                onDeleteWorkflow ? () => setDeleteConfirmOpen(true) : undefined
              }
              deletingWorkflow={deletingWorkflow}
            />
          </div>
          <AlertDialog.Root
            open={deleteConfirmOpen}
            onOpenChange={(nextOpen) => {
              if (deletingWorkflow && !nextOpen) return;
              setDeleteConfirmOpen(nextOpen);
            }}
          >
            <AlertDialog.Portal>
              <AlertDialog.Overlay className="ai-workflow-alert__overlay" />
              <AlertDialog.Content className="ai-workflow-alert__content">
                <AlertDialog.Title className="ai-workflow-alert__title">
                  删除工作流？
                </AlertDialog.Title>
                <AlertDialog.Description className="ai-workflow-alert__description">
                  {workflowName
                    ? `确认删除“${workflowName}”？此操作不可恢复。`
                    : "确认删除该工作流？此操作不可恢复。"}
                </AlertDialog.Description>
                <div className="ai-workflow-alert__actions">
                  <AlertDialog.Cancel asChild>
                    <button
                      type="button"
                      className="ai-workflow-alert__btn ai-workflow-alert__btn--cancel"
                      disabled={deletingWorkflow}
                    >
                      取消
                    </button>
                  </AlertDialog.Cancel>
                  <AlertDialog.Action asChild>
                    <button
                      type="button"
                      className="ai-workflow-alert__btn ai-workflow-alert__btn--danger"
                      disabled={deletingWorkflow}
                      onClick={() => void onDeleteWorkflow?.()}
                    >
                      {deletingWorkflow ? "删除中..." : "删除"}
                    </button>
                  </AlertDialog.Action>
                </div>
              </AlertDialog.Content>
            </AlertDialog.Portal>
          </AlertDialog.Root>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
