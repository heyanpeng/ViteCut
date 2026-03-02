#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const workspaceRoot = path.join(__dirname, '..');
const vendorDir = path.join(workspaceRoot, 'vendor/react-timeline-editor');
const yarnBin = path.join(vendorDir, '.yarn/releases/yarn-4.9.2.cjs');
const distDir = path.join(
  workspaceRoot,
  'vendor/react-timeline-editor/packages/timeline/dist'
);
const isRefreshMode = process.argv.includes('--refresh');
const requiredDistFiles = [
  'index.es.js',
  'react-timeline-editor.css',
  'index.d.ts',
];
const registries = [
  'https://registry.npmmirror.com',
  'https://registry.npmjs.org',
];
const httpTimeout = '120000';
const commandTimeoutMs = 180000;

function ensureVendorDistExists() {
  const missingFiles = requiredDistFiles.filter(
    (fileName) => !fs.existsSync(path.join(distDir, fileName))
  );
  if (missingFiles.length === 0) {
    return;
  }

  console.error('[build:vendor] 缺少 vendor 构建产物，当前为离线模式，不会在构建阶段联网下载依赖。');
  console.error(
    `[build:vendor] 缺失文件: ${missingFiles.join(', ')}`
  );
  console.error('[build:vendor] 请先在可联网环境执行一次: pnpm --filter @vitecut/timeline run build:vendor:refresh');
  process.exit(1);
}

function runPostVendorDist() {
  // dist/package.json 供目录 import 时解析
  fs.writeFileSync(
    path.join(distDir, 'package.json'),
    JSON.stringify(
      {
        type: 'module',
        main: 'index.es.js',
        module: 'index.es.js',
        types: 'index.d.ts',
      },
      null,
      2
    )
  );

  // index.es.d.ts 供从 index.es.js 导入时的类型解析
  fs.writeFileSync(
    path.join(distDir, 'index.es.d.ts'),
    "export * from './components/timeline';\nexport * from './interface/timeline';\n"
  );

  console.log('post-vendor-dist: wrote dist/package.json and index.es.d.ts');
}

function runYarn(registry, args) {
  return spawnSync(process.execPath, [yarnBin, ...args], {
    cwd: vendorDir,
    stdio: 'inherit',
    timeout: commandTimeoutMs,
    env: {
      ...process.env,
      YARN_NPM_REGISTRY_SERVER: registry,
      YARN_HTTP_TIMEOUT: httpTimeout,
      npm_config_registry: registry,
    },
  });
}

function isFailed(result) {
  return result.status !== 0 || Boolean(result.signal) || Boolean(result.error);
}

function printFailure(commandName, registry, result) {
  const statusText = result.status === null ? 'null' : String(result.status);
  const signalText = result.signal || 'none';
  const errorText = result.error ? result.error.message : 'none';
  console.log(
    `[build:vendor:refresh] ${commandName} 失败: ${registry} (status=${statusText}, signal=${signalText}, error=${errorText})`
  );
}

function runBuildWithRegistry(registry) {
  console.log(`[build:vendor:refresh] 使用源: ${registry} (timeout=${commandTimeoutMs}ms)`);
  const installResult = runYarn(registry, ['install']);
  if (isFailed(installResult)) {
    printFailure('install', registry, installResult);
    return false;
  }

  const buildResult = runYarn(registry, ['build']);
  if (isFailed(buildResult)) {
    printFailure('build', registry, buildResult);
    return false;
  }
  return true;
}

function refreshVendorDist() {
  let ok = false;
  for (const registry of registries) {
    if (runBuildWithRegistry(registry)) {
      ok = true;
      break;
    }
    console.log('[build:vendor:refresh] 切换下一个源重试...');
  }

  if (!ok) {
    console.error('[build:vendor:refresh] 所有源都失败，停止构建');
    process.exit(1);
  }
}

if (isRefreshMode) {
  refreshVendorDist();
} else {
  ensureVendorDistExists();
  console.log('[build:vendor] 离线模式：复用仓库内 vendor dist 产物');
}
runPostVendorDist();
