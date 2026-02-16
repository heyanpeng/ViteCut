import { create } from "zustand";

/**
 * 示例代码（Example Store）
 *
 * 本文件为示例/参考代码，展示如何使用 zustand 创建状态管理 store。
 * 实际业务请使用 projectStore 等，可保留本文件作参考或按需移除。
 */

/**
 * 示例 Store 状态接口
 */
export interface ExampleState {
  count: number;
  name: string;
}

/**
 * 示例 Store Actions 接口
 */
export interface ExampleActions {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
  setName: (name: string) => void;
  incrementAsync: () => Promise<void>;
}

/**
 * 示例 Store 类型
 */
export type ExampleStore = ExampleState & ExampleActions;

/**
 * 示例 Store 初始状态
 */
const initialState: ExampleState = {
  count: 0,
  name: "ViteCut",
};

/**
 * 示例 Store
 *
 * 展示如何使用 zustand 创建状态管理 store
 */
export const useExampleStore = create<ExampleStore>((set) => ({
  ...initialState,

  // 同步 actions
  increment: () => set((state: ExampleState) => ({ count: state.count + 1 })),

  decrement: () => set((state: ExampleState) => ({ count: state.count - 1 })),

  reset: () => set(initialState),

  setName: (name: string) => set({ name }),

  // 异步 action 示例
  incrementAsync: async () => {
    // 模拟异步操作
    await new Promise((resolve) => setTimeout(resolve, 1000));
    set((state: ExampleState) => ({ count: state.count + 1 }));
  },
}));
