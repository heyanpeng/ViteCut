# SwiftAV Monorepo

这是一个使用 pnpm workspaces 组织的多包项目。

## 项目结构

```
SwiftAV/
├── packages/
│   ├── app/                  # React 应用
│   └── @swiftav/timeline/    # 时间轴逻辑包
├── pnpm-workspace.yaml       # pnpm workspaces 配置
└── package.json              # 根 package.json（统一脚本）
```

## 安装依赖

在项目根目录运行：

```bash
pnpm install
```

## 开发

### 运行应用

```bash
# 运行 SwiftAV 应用
pnpm dev

# 或者直接进入包目录
cd packages/app
pnpm dev
```

### 构建所有包

```bash
pnpm build
```

## 包说明

### @swiftav/timeline

时间轴逻辑包，提供时间轴相关的核心数据结构与转换工具。

### swiftav

React + TypeScript + Vite 应用。

## 脚本命令

- `pnpm dev` - 运行应用开发服务器
- `pnpm build` - 构建所有包（时间轴包 + 应用）
- `pnpm build:timeline` - 仅构建时间轴包
- `pnpm build:app` - 仅构建应用
- `pnpm lint` - 运行所有包的 lint 检查
- `pnpm preview` - 预览构建后的应用

## 技术栈

- **包管理**: pnpm workspaces
- **应用框架**: React + TypeScript + Vite
- **状态管理**: Zustand
- **SDK**: TypeScript 库包

## 状态管理

项目使用 [Zustand](https://github.com/pmndrs/zustand) 作为状态管理库。Zustand 是一个轻量级、简单易用的状态管理解决方案。

### Store 结构

Store 文件位于 `packages/app/src/stores/` 目录：

```
packages/app/src/stores/
├── index.ts          # Store 统一导出
└── exampleStore.ts   # 示例 Store
```

### 使用示例

**创建 Store：**

```typescript
import { create } from 'zustand';

interface ExampleState {
  count: number;
  name: string;
}

interface ExampleActions {
  increment: () => void;
  decrement: () => void;
  reset: () => void;
}

type ExampleStore = ExampleState & ExampleActions;

export const useExampleStore = create<ExampleStore>((set) => ({
  count: 0,
  name: 'SwiftAV',
  
  increment: () => set((state) => ({ count: state.count + 1 })),
  decrement: () => set((state) => ({ count: state.count - 1 })),
  reset: () => set({ count: 0, name: 'SwiftAV' }),
}));
```

**在组件中使用：**

```typescript
import { useExampleStore } from '@/stores';

function MyComponent() {
  const { count, increment, decrement } = useExampleStore();
  
  return (
    <div>
      <p>Count: {count}</p>
      <button onClick={increment}>+</button>
      <button onClick={decrement}>-</button>
    </div>
  );
}
```

**选择性地订阅状态：**

```typescript
// 只订阅 count，避免不必要的重渲染
const count = useExampleStore((state) => state.count);
```

### 最佳实践

1. **类型安全**: 使用 TypeScript 定义 State、Actions 和 Store 类型
2. **分离关注点**: 将 State 和 Actions 分别定义接口
3. **统一导出**: 通过 `stores/index.ts` 统一导出所有 store
4. **选择性订阅**: 使用选择器函数只订阅需要的状态，优化性能
