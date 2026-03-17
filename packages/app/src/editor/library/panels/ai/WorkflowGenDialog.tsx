import { Dialog } from "radix-ui";
import { WorkflowComposer } from "@vitecut/workflow";

export function WorkflowGenDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
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
            <WorkflowComposer onExit={() => onOpenChange(false)} />
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
