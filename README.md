# SwiftAV Monorepo

这是一个使用 pnpm workspaces 组织的多包项目。

## 项目结构

```
SwiftAV/
├── packages/
│   ├── swiftav/          # React 应用
│   └── swiftav-sdk/      # SDK 库包
├── pnpm-workspace.yaml   # pnpm workspaces 配置
└── package.json          # 根 package.json（统一脚本）
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
cd packages/swiftav
pnpm dev
```

### 构建 SDK

```bash
# 构建 SDK
pnpm build:sdk

# SDK 开发模式（监听文件变化）
cd packages/swiftav-sdk
pnpm dev
```

### 构建所有包

```bash
pnpm build
```

## 包说明

### @swiftav/sdk

SDK 库包，提供 SwiftAV 的核心功能。

**使用方式：**

```typescript
import { helloSDK } from '@swiftav/sdk'

console.log(helloSDK())
```

### swiftav

React + TypeScript + Vite 应用，依赖 `@swiftav/sdk`。

## 脚本命令

- `pnpm dev` - 运行应用开发服务器
- `pnpm build` - 构建所有包
- `pnpm build:sdk` - 仅构建 SDK
- `pnpm build:app` - 仅构建应用
- `pnpm lint` - 运行所有包的 lint 检查
- `pnpm preview` - 预览构建后的应用

## 技术栈

- **包管理**: pnpm workspaces
- **应用框架**: React + TypeScript + Vite
- **SDK**: TypeScript 库包
