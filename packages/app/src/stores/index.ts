/**
 * Store 导出文件
 *
 * 统一导出所有 store，方便在其他组件中使用
 */

/** 以下为示例代码：展示 zustand 用法，业务可参考或移除 */
export { useExampleStore } from "./exampleStore";
export type {
  ExampleStore,
  ExampleState,
  ExampleActions,
} from "./exampleStore";

export { useProjectStore } from "./projectStore";
export type {
  ProjectStore,
  ProjectStoreState,
  ProjectStoreActions,
} from "./projectStore.types";

export { useTaskStore } from "./taskStore";
export type { Task, TaskStatus, TaskType } from "./taskStore";
