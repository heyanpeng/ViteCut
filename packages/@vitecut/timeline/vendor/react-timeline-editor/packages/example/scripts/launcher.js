#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '../');

// 获取所有入口文件
function getEntryFiles() {
  const entriesDir = path.join(projectRoot, 'src/entries');
  if (!fs.existsSync(entriesDir)) {
    console.error('❌ 入口文件目录不存在:', entriesDir);
    process.exit(1);
  }

  const files = fs.readdirSync(entriesDir)
    .filter(file => file.endsWith('.tsx') || file.endsWith('.jsx'))
    .map(file => ({
      name: path.basename(file, path.extname(file)),
      path: path.join(entriesDir, file)
    }));

  return files;
}

// 显示选择菜单
function showMenu(entries) {
  console.log('\n🚀 React Timeline Editor - 示例启动器\n');
  console.log('请选择要启动的示例页面:');
  console.log('='.repeat(50));

  entries.forEach((entry, index) => {
    console.log(`${index + 1}. ${entry.name}`);
  });

  console.log(`${entries.length + 1}. 主页面 (包含所有示例导航)`);
  console.log('0. 退出');
  console.log('='.repeat(50));
}

// 获取用户选择
async function getUserChoice(entries) {
  const readline = await import('readline');
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  return new Promise((resolve) => {
    rl.question('\n请输入选择编号: ', (answer) => {
      rl.close();
      const choice = parseInt(answer);

      if (choice === 0) {
        console.log('👋 再见!');
        process.exit(0);
      }

      if (choice === entries.length + 1) {
        resolve('main');
      } else if (choice >= 1 && choice <= entries.length) {
        resolve(entries[choice - 1].name);
      } else {
        console.log('❌ 无效的选择，请重新输入');
        resolve(null);
      }
    });
  });
}

// 创建HTML文件
function createHtmlFile(entryName) {
  const htmlTemplate = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>React Timeline Editor - ${entryName}</title>
</head>
<body>
    <div id="root"></div>
    <script type="module" src="/src/entries/${entryName}.tsx"></script>
</body>
</html>`;

  fs.writeFileSync(path.join(projectRoot, 'index.html'), htmlTemplate);
  console.log(`✅ 已创建 ${entryName} 的HTML文件`);
}

// 启动开发服务器
function startDevServer() {
  console.log('\n🚀 启动开发服务器...');
  try {
    execSync('yarn vite', {
      cwd: projectRoot,
      stdio: 'inherit',
      env: { ...process.env, FORCE_COLOR: '1' }
    });
  } catch (error) {
    console.error('❌ 启动开发服务器失败:', error.message);
    process.exit(1);
  }
}

// 主函数
async function main() {
  const entries = getEntryFiles();

  if (entries.length === 0) {
    console.error('❌ 未找到任何入口文件，请先创建示例页面');
    process.exit(1);
  }

  let selectedEntry = null;

  while (!selectedEntry) {
    showMenu(entries);
    selectedEntry = await getUserChoice(entries);
  }

  console.log(`\n🎯 选择: ${selectedEntry}`);

  // 创建对应的HTML文件
  createHtmlFile(selectedEntry);

  // 启动开发服务器
  startDevServer();
}

// 处理命令行参数
if (process.argv.length > 2) {
  const arg = process.argv[2];
  if (arg === '--help' || arg === '-h') {
    console.log(`
React Timeline Editor 示例启动器

用法:
  yarn example run         启动交互式选择菜单
  yarn example run <name>  直接启动指定示例

示例:
  yarn example run basic    启动基础示例
  yarn example run main     启动主页面
    `);
    process.exit(0);
  } else {
    // 直接启动指定示例
    const entries = getEntryFiles();
    const entryNames = entries.map(e => e.name);

    if (entryNames.includes(arg) || arg === 'main') {
      createHtmlFile(arg);
      startDevServer();
    } else {
      console.error(`❌ 未找到示例: ${arg}`);
      console.log('可用的示例:', entryNames.join(', '));
      process.exit(1);
    }
  }
} else {
  // 交互式启动
  main().catch(console.error);
}