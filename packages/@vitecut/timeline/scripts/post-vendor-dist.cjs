#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const distDir = path.join(
  __dirname,
  '../vendor/react-timeline-editor/packages/timeline/dist'
);

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
