import { normalizePosixPath } from '@rspress/shared';
import { getNodeAttribute } from '@rspress/shared/node-utils';
import * as fs from 'fs-extra';
import type { Code, Root } from 'mdast';
import type { MdxJsxFlowElement } from 'mdast-util-mdx-jsx';
import type { MdxjsEsm } from 'mdast-util-mdxjs-esm';
import { basename, dirname, resolve } from 'node:path';
import type { Plugin } from 'unified';
import { visit } from 'unist-util-visit';
import { getASTNodeImport, getExternalDemoContent } from './ast-helpers';
import { virtualDir } from './constant';
import { extractDependencies, getFileType, resolveAlias } from './extract-dependencies';
import type { DemoInfo, RemarkPluginOptions } from './types';
import { generateId } from './utils';

export const demos: DemoInfo = {};

export const remarkCodeToDemo: Plugin<[RemarkPluginOptions], Root> = function ({ getRouteMeta, builderConfig }) {
  const routeMeta = getRouteMeta();
  fs.mkdirSync(virtualDir, { recursive: true });
  const data = this.data() as {
    pageMeta: Record<string, unknown>;
  };
  return (tree, vfile) => {
    const demoMdx: MdxjsEsm[] = [];
    const route = routeMeta.find((meta) => normalizePosixPath(meta.absolutePath) === normalizePosixPath(vfile.path || vfile.history[0]));
    if (!route) {
      return;
    }
    const { pageName } = route;
    // clear all demo in this pageName and recollect, because we may delete the demo
    demos[pageName] = [];
    let title = pageName;
    let index = 1;
    let externalDemoIndex = 0;
    let depsIndex = 0;

    function constructDemoNode(
      demoId: string,
      demoPath: string,
      currentNode: Code | MdxJsxFlowElement,
      // Only for external demo
      externalDemoIndex?: number,
    ) {
      const relativePathReg = new RegExp(/^\.\.?\/.*$/);
      demos[pageName].push({
        title,
        id: demoId,
        path: relativePathReg.test(demoPath) ? resolve(vfile.dirname || dirname(vfile.path), demoPath) : demoPath,
      });

      // get external demo content
      const tempVar = `externalDemoContent${externalDemoIndex}`;
      const fileData: {[filePath: string]: { key: string; fileName: string; ext: string | undefined }}  = {};
      const depsKey = `deps`;

      demoMdx.push(getASTNodeImport(`Demo${demoId}`, demoPath));
      if (externalDemoIndex !== undefined) {
        // Such as `import externalDemoContent0 from '!!foo?raw'`
        // `!!` prefix is used to avoid other loaders in rspack
        demoMdx.push(getASTNodeImport(tempVar, `!!${demoPath}?raw`));

        const dealDeps = (key: string, aimPath: string) => {
          const filePath = resolveAlias(aimPath, (builderConfig.resolve?.alias || {}) as Record<string, string>) ?? '';
          if(fileData[filePath]) {
            return;
          }
          fileData[filePath] = { key, fileName: basename(filePath), ext: getFileType(filePath) };
          const fileContent = fs.readFileSync(filePath, 'utf-8');
          const absoluteDemoDir = dirname(filePath);
          const dependencies = extractDependencies(fileContent, absoluteDemoDir);
          dependencies.forEach((dep) => {
            const key = `${depsKey}${depsIndex++}`;
            demoMdx.push(getASTNodeImport(key, `!!${dep}?raw`));
            dealDeps(key, dep);
          });
        };
        dealDeps(tempVar, demoPath);
      }

      const fileDataArr = Object.values(fileData);
      // Use container to show the code and view
      Object.assign(currentNode, {
        type: 'mdxJsxFlowElement',
        name: 'Container',
        attributes: [
          {
            type: 'mdxJsxAttribute',
            name: 'demoId',
            value: demoId,
          },
          {
            type: 'mdxJsxAttribute',
            name: 'names',
            value: fileDataArr.map((dep) => dep.fileName).join(','),
          },
        ],
        children: [
          {
            type: 'mdxJsxFlowElement',
            name: `Demo${demoId}`,
          },
          ...fileDataArr.map((dep) => getExternalDemoContent(dep.key, dep.ext)),
        ],
      });
    }
    visit(tree, 'heading', (node) => {
      if (node.depth === 1) {
        const firstChild = node.children[0];
        title = (firstChild && 'value' in firstChild && firstChild.value) || title;
      }
    });

    // 1. External demo , use <code src="foo" /> to declare demo
    visit(tree, 'mdxJsxFlowElement', (node) => {
      if (node.name === 'code') {
        const src = getNodeAttribute(node, 'src');

        if (typeof src !== 'string') {
          return;
        }

        // don't support expression syntax
        const id = generateId(pageName, index++);
        constructDemoNode(id, src, node, externalDemoIndex++);
      }
    });

    tree.children.unshift(...demoMdx);

    if (demos[pageName].length > 0) {
      data.pageMeta.haveDemos = true;
    }
  };
};
