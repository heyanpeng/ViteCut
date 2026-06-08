import { useCallback } from "react";
import { useNodeId, useReactFlow } from "@xyflow/react";
import { DropdownMenu } from "radix-ui";
import { ArrowUp, ChevronDown, Sparkles } from "lucide-react";
import type { NodeParamPanelProps } from "./PlaceholderParamPanel";
import { PROMPT_MODEL_OPTIONS } from "../workflowConfig";
import "./shared.css";
import "./PromptParamPanel.css";

const PROMPT_PLACEHOLDER =
  "描述你想要生成的内容，并在下方调整生成参数。(按下Enter 生成，Shift+Enter 换行)";

export function PromptParamPanel({ data }: NodeParamPanelProps) {
  const nodeId = useNodeId();
  const rf = useReactFlow();
  const summary = typeof data.summary === "string" ? data.summary : "";
  const selectedModel =
    PROMPT_MODEL_OPTIONS.find((opt) => opt.id === data.model) ??
    PROMPT_MODEL_OPTIONS[0];

  const handleSummaryChange = useCallback(
    (event: React.ChangeEvent<HTMLTextAreaElement>) => {
      if (!nodeId) return;
      rf.updateNodeData(nodeId, { summary: event.target.value });
    },
    [nodeId, rf]
  );

  const handleModelChange = useCallback(
    (modelId: string) => {
      if (!nodeId) return;
      rf.updateNodeData(nodeId, { model: modelId });
    },
    [nodeId, rf]
  );

  const handleSend = useCallback(() => {
    console.log("[PromptParamPanel] run", { nodeId, data });
  }, [nodeId, data]);

  return (
    <div className="node-param-panel prompt-param-panel">
      <textarea
        className="prompt-param-panel__textarea"
        value={summary}
        onChange={handleSummaryChange}
        placeholder={PROMPT_PLACEHOLDER}
        rows={3}
      />
      <div className="prompt-param-panel__row">
        <DropdownMenu.Root>
          <DropdownMenu.Trigger asChild>
            <button type="button" className="prompt-param-panel__model">
              <Sparkles
                size={14}
                strokeWidth={1.8}
                className="prompt-param-panel__model-icon"
              />
              {selectedModel.name}
              <ChevronDown size={14} strokeWidth={1.8} />
            </button>
          </DropdownMenu.Trigger>
          <DropdownMenu.Portal>
            <DropdownMenu.Content
              className="prompt-param-panel__model-menu"
              sideOffset={6}
              align="start"
            >
              {PROMPT_MODEL_OPTIONS.map((opt) => (
                <DropdownMenu.Item
                  key={opt.id}
                  className="prompt-param-panel__model-item"
                  onSelect={() => handleModelChange(opt.id)}
                >
                  {opt.name}
                </DropdownMenu.Item>
              ))}
            </DropdownMenu.Content>
          </DropdownMenu.Portal>
        </DropdownMenu.Root>
        <span className="prompt-param-panel__spacer" />
        <span className="prompt-param-panel__quota">今日限免还剩 3次</span>
        <button
          type="button"
          className="prompt-param-panel__send"
          onClick={handleSend}
          aria-label="生成"
        >
          <ArrowUp size={16} strokeWidth={2} />
        </button>
      </div>
    </div>
  );
}
