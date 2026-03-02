#!/usr/bin/env node
const path = require('path');
const { spawnSync } = require('child_process');

const workspaceRoot = path.join(__dirname, '..');
const vendorDir = path.join(workspaceRoot, 'vendor/react-timeline-editor');
const yarnBin = path.join(vendorDir, '.yarn/releases/yarn-4.9.2.cjs');

const registries = [
  'https://registry.npmmirror.com',
  'https://registry.npmjs.org',
];
const httpTimeout = '120000';
const commandTimeoutMs = 180000;

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
    `[build:vendor] ${commandName} 失败: ${registry} (status=${statusText}, signal=${signalText}, error=${errorText})`
  );
}

function runBuildWithRegistry(registry) {
  console.log(`[build:vendor] 使用源: ${registry} (timeout=${commandTimeoutMs}ms)`);
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

let ok = false;
for (const registry of registries) {
  if (runBuildWithRegistry(registry)) {
    ok = true;
    break;
  }
  console.log(`[build:vendor] 切换下一个源重试...`);
}

if (!ok) {
  console.error('[build:vendor] 所有源都失败，停止构建');
  process.exit(1);
}

const postVendorScript = path.join(workspaceRoot, 'scripts/post-vendor-dist.cjs');
const postResult = spawnSync(process.execPath, [postVendorScript], {
  cwd: workspaceRoot,
  stdio: 'inherit',
});

if (postResult.status !== 0) {
  process.exit(postResult.status || 1);
}
