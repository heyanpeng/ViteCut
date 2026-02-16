/**
 * 画布编辑工具（基于 Konva.js）
 *
 * 对外 API 统一由此入口导出。
 */

// 主类
export * from "./CanvasEditor";

// 子模块（供高级使用）
export { SelectionManager } from "./SelectionManager";
export { VideoAnimationManager } from "./VideoAnimationManager";
export { ElementSynchronizer } from "./ElementSynchronizer";

// 工具函数和常量
export * from "./utils";
export * from "./constants";

// 类型定义
export * from "./types/elements";
export * from "./types/editor";
