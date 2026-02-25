import react from '@vitejs/plugin-react';
import path from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  // 配置使用的插件列表
  plugins: [
    react(), 
    // 使用 dts 插件生成 TypeScript 声明文件
    dts({ 
      include: ['src/**/*'], 
      outDir: 'dist', 
      insertTypesEntry: true, 
      compilerOptions: { 
        declaration: true, 
        emitDeclarationOnly: true 
      } 
    })
  ],
  // 配置路径别名
  resolve: {
  },
  // 构建配置
  build: {
    // 库模式配置
    lib: {
      entry: path.resolve(__dirname, 'src/index.tsx'),
      name: 'react-timeline-editor',
      formats: ['es', 'umd', 'cjs'],
      fileName: (format) => `index.${format}.js`,
    },
    // Rollup 打包选项
    rollupOptions: {
      // 确保外部化处理那些你不想打包进库的依赖
      external: ['react', 'react-dom', 'react/jsx-runtime'],
      output: {
        // 在 UMD 构建模式下为这些外部化的依赖提供一个全局变量
        globals: {
          react: 'React',
          'react-dom': 'ReactDOM',
          'react/jsx-runtime': 'ReactJsxRuntime',
        },
      },
    },
  },
});
