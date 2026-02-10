/**
 * Store 导出文件
 * 
 * 统一导出所有 store，方便在其他组件中使用
 */

export { useExampleStore } from "./exampleStore";
export type { ExampleStore, ExampleState, ExampleActions } from "./exampleStore";
export { useProjectStore } from "./projectStore";
export type { ProjectStore, ProjectStoreState, ProjectStoreActions } from "./projectStore";
