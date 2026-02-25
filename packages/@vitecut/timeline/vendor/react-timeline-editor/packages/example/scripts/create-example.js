#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const projectRoot = path.resolve(__dirname, '..');
const componentsDir = path.join(projectRoot, 'src', 'components');
const entriesDir = path.join(projectRoot, 'src', 'entries');
const configFile = path.join(projectRoot, 'src', 'config', 'app-config.ts');

// 获取示例名称参数
const exampleName = process.argv[2];

if (!exampleName) {
  console.error('❌ 请提供示例名称，例如: node scripts/create-example.js my-example');
  process.exit(1);
}

// 验证示例名称格式
if (!/^[a-z][a-z0-9-]*$/.test(exampleName)) {
  console.error('❌ 示例名称只能包含小写字母、数字和连字符，且必须以字母开头');
  process.exit(1);
}

// 检查示例是否已存在
const exampleDir = path.join(componentsDir, exampleName);
if (fs.existsSync(exampleDir)) {
  console.error(`❌ 示例 "${exampleName}" 已存在`);
  process.exit(1);
}

// 创建示例文件夹
fs.mkdirSync(exampleDir, { recursive: true });
console.log(`✅ 创建示例文件夹: ${exampleName}`);

// 创建组件文件
const componentContent = `import React from 'react';
import { useNavigate } from 'react-router-dom';
import './index.less';

interface ${capitalizeFirst(exampleName)}Props {
  // 组件属性定义
}

const ${capitalizeFirst(exampleName)}: React.FC<${capitalizeFirst(exampleName)}Props> = () => {
  const navigate = useNavigate();

  return (
    <div className="${exampleName}-container">
      <div className="page-header">
        <button
          className="back-button"
          onClick={() => navigate('/main')}
        >
          ← 返回主页面
        </button>
        <h1>${capitalizeFirst(exampleName)} 示例</h1>
      </div>
      <p>这是 ${exampleName} 示例的占位内容</p>
      <div className="${exampleName}-content">
        {/* 示例内容将在这里实现 */}
      </div>
    </div>
  );
};

export default ${capitalizeFirst(exampleName)};
`;

fs.writeFileSync(path.join(exampleDir, `index.tsx`), componentContent);
console.log(`✅ 创建组件文件: ${exampleName}/index.tsx`);

// 创建样式文件
const cssContent = `.${exampleName}-container {
  padding: 20px;
  max-width: 800px;
  margin: 0 auto;
}

.${exampleName}-container .page-header {
  display: flex;
  align-items: center;
  margin-bottom: 30px;
  border-bottom: 1px solid #eee;
  padding-bottom: 20px;
}

.${exampleName}-container .back-button {
  background: #007bff;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  cursor: pointer;
  margin-right: 20px;
  font-size: 14px;
}

.${exampleName}-container .back-button:hover {
  background: #0056b3;
}

.${exampleName}-container h1 {
  color: #333;
  margin: 0;
}

.${exampleName}-container p {
  color: #666;
  margin-bottom: 24px;
}

.${exampleName}-content {
  border: 1px solid #e0e0e0;
  border-radius: 8px;
  padding: 20px;
  background-color: #f9f9f9;
  min-height: 200px;
}`;

fs.writeFileSync(path.join(exampleDir, `index.less`), cssContent);
console.log(`✅ 创建样式文件: ${exampleName}/index.less`);

// 创建入口文件
const entryContent = `import React from 'react';
import ReactDOM from 'react-dom/client';
import ${capitalizeFirst(exampleName)} from '../components/${exampleName}';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);

root.render(
  <React.StrictMode>
    <${capitalizeFirst(exampleName)} />
  </React.StrictMode>
);
`;

fs.writeFileSync(path.join(entriesDir, `${exampleName}.tsx`), entryContent);
console.log(`✅ 创建入口文件: ${exampleName}.tsx`);

// 更新统一配置文件
updateConfigFile(exampleName);

// 更新主入口文件
updateMainEntry(exampleName);

console.log(`\n🎉 示例 "${exampleName}" 创建成功！`);
console.log(`📁 组件位置: src/components/${exampleName}/`);
console.log(`📄 入口文件: src/entries/${exampleName}.tsx`);
console.log(`🔧 配置已自动添加到 src/config/app-config.ts`);
console.log(`🚀 主入口文件已自动更新`);

function capitalizeFirst(str) {
  // 将连字符分隔的单词转换为驼峰命名法
  return str
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
}

function updateConfigFile(exampleName) {
  const configContent = fs.readFileSync(configFile, 'utf8');

  // 找到应用配置数组的结束位置
  const configsEndIndex = configContent.lastIndexOf('\n];');
  if (configsEndIndex === -1) {
    console.error('❌ 无法找到配置文件中的应用配置数组');
    return;
  }

  // 在数组结束前插入新配置
  const newConfig = `
  {
    id: '${exampleName}',
    path: '/${exampleName}',
    componentName: '${capitalizeFirst(exampleName)}',
    title: '${capitalizeFirst(exampleName)}',
    description: '${capitalizeFirst(exampleName)} 示例描述',
    route: '/${exampleName}',
    icon: '⭐',
    color: '#${Math.floor(Math.random()*16777215).toString(16)}',
    status: 'development'
  },`;

  const updatedContent = configContent.slice(0, configsEndIndex) + newConfig + configContent.slice(configsEndIndex);

  fs.writeFileSync(configFile, updatedContent);
  console.log(`✅ 更新配置文件: app-config.ts`);
}



function updateMainEntry(exampleName) {
  const mainEntryFile = path.join(projectRoot, 'src', 'entries', 'main.tsx');
  let mainEntryContent = fs.readFileSync(mainEntryFile, 'utf8');

  // 在组件导入部分添加新组件的导入语句
  const importStatement = `import ${capitalizeFirst(exampleName)} from '../components/${exampleName}';`;

  // 找到最后一个import语句的位置
  const lastImportIndex = mainEntryContent.lastIndexOf('import');
  const nextLineAfterLastImport = mainEntryContent.indexOf('\n', lastImportIndex) + 1;

  // 在最后一个import语句后插入新import
  mainEntryContent = mainEntryContent.slice(0, nextLineAfterLastImport) + '\n' + importStatement + mainEntryContent.slice(nextLineAfterLastImport);

  // 在组件映射表中添加新组件
  const componentMapStart = mainEntryContent.indexOf('const componentMap: Record<string, React.FC> = {');
  const componentMapEnd = mainEntryContent.indexOf('};', componentMapStart) + 2;

  // 在组件映射表结束前插入新组件
  const componentMapContent = mainEntryContent.slice(componentMapStart, componentMapEnd);
  const lastComponentIndex = componentMapContent.lastIndexOf(',');
  const newComponentMapContent = componentMapContent.slice(0, lastComponentIndex + 1) + `\n  ${capitalizeFirst(exampleName)},` + componentMapContent.slice(lastComponentIndex + 1);

  mainEntryContent = mainEntryContent.slice(0, componentMapStart) + newComponentMapContent + mainEntryContent.slice(componentMapEnd);

  fs.writeFileSync(mainEntryFile, mainEntryContent);
  console.log(`✅ 更新主入口文件: main.tsx`);
}
