// 使用 @babel/parser 进行 AST 解析
import * as parser from '@babel/parser';
import type Traverse from '@babel/traverse';
import type { File } from '@babel/types';
import * as fs from 'fs-extra';
import * as path from 'node:path';

// 判断是否为本地路径（相对路径或项目内路径）
function isLocalPath(path: string): boolean {
  return path.startsWith('./') || path.startsWith('../') || (!path.startsWith('http') && !path.startsWith('@') && !path.includes('/node_modules/'));
}

// 尝试添加常见的扩展名
const extensions = ['.ts', '.tsx', '.js', '.jsx', '.css', '.scss', '.less', '.json'];
// 解析导入路径，处理无扩展名的情况
export function resolveImportPath(baseDir: string, importPath: string): string | null {
  // 检查是否已经有扩展名
  const hasExtension = extensions.some((ext) => importPath.endsWith(ext));

  if (hasExtension) {
    const fullPath = path.resolve(baseDir, importPath);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
    return null;
  }

  // 尝试添加不同的扩展名
  for (const ext of extensions) {
    const fullPath = path.resolve(baseDir, `${importPath}${ext}`);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  // 尝试作为目录解析，查找 index 文件
  for (const ext of extensions) {
    const fullPath = path.resolve(baseDir, importPath, `index${ext}`);
    if (fs.existsSync(fullPath)) {
      return fullPath;
    }
  }

  return null;
}

export function getFileType(filePath: string) {
  const ext = path.extname(filePath);
  const extension = extensions.find((item) => item === ext);
  if (!extension) return;
  return extension.replace('.', '');
}

// 解析路径别名
export function resolveAlias(filePath: string, alias?: Record<string, string>): string | null {
  if (!alias || typeof alias !== 'object') {
    return filePath;
  }

  // 检查路径是否已经是绝对路径
  if (path.isAbsolute(filePath)) {
    const baseDir = path.dirname(filePath);
    return resolveImportPath(baseDir, filePath);
  }

  // 检查路径是否包含别名
  for (const [aliasKey, aliasPath] of Object.entries(alias)) {
    // 如果路径以别名开头
    if (filePath.startsWith(aliasKey + '/') || filePath === aliasKey) {
      // 替换别名部分
      const replacedPath = filePath.replace(aliasKey, aliasPath);
      const baseDir = path.dirname(replacedPath);
      return resolveImportPath(baseDir, replacedPath);
    }
  }

  return filePath;
}

/**
 * remark plugin to transform code to demo
 */
// 从文件内容中提取依赖
export function extractDependencies(fileContent: string, baseDir: string): string[] {
  const dependencies: string[] = [];

  try {
    // 解析 JS/TS/JSX/TSX 文件
    const ast = parser.parse(fileContent, {
      sourceType: 'module',
      plugins: ['jsx', 'typescript'],
    });

    const traverse: { default: typeof Traverse } = require('@babel/traverse');
    // 遍历 AST 提取 import 语句和 require 调用
    traverse.default(ast as File, {
      ImportDeclaration(path) {
        const importPath = path.node.source.value;
        // 忽略 node_modules 中的依赖，只处理相对路径和项目内路径
        if (isLocalPath(importPath)) {
          const fullPath = resolveImportPath(baseDir, importPath);
          if (fullPath && fs.existsSync(fullPath)) {
            dependencies.push(fullPath);
          }
        }
      },

      CallExpression(path) {
        // 处理 require 调用
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === 'require') {
          const arg = path.node.arguments[0];
          if (arg && arg.type === 'StringLiteral') {
            const requirePath = arg.value;
            if (isLocalPath(requirePath)) {
              const fullPath = resolveImportPath(baseDir, requirePath);
              if (fullPath && fs.existsSync(fullPath)) {
                dependencies.push(fullPath);
              }
            }
          }
        }
      },
    });
  } catch (error) {
    console.warn(`Failed to parse file content: ${error}`);
  }

  return dependencies;
}
