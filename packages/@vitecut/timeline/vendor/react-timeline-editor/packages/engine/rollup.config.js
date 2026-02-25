import typescript from '@rollup/plugin-typescript';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';

const isDev = process.env.NODE_ENV === 'development';

// 共享配置
const sharedConfig = {
  input: 'src/index.ts',
  plugins: [
    nodeResolve(),
    commonjs(),
    typescript({
      tsconfig: './tsconfig.build.json',
      sourceMap: isDev,
      inlineSources: isDev,
    }),
  ],
};

// 开发模式配置
const devConfig = [
  // ES模块版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      ...sharedConfig.plugins,
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false, // 禁用Rollup生成声明文件，使用tsc单独生成
        sourceMap: true,
        inlineSources: true,
      }),
    ],
    watch: {
      include: 'src/**',
    },
  },
  // CommonJS版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    watch: {
      include: 'src/**',
    },
  },
];

// 生产模式配置
const prodConfig = [
  // ES模块版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.esm.js',
      format: 'es',
      sourcemap: true,
    },
    plugins: [
      ...sharedConfig.plugins,
      typescript({
        tsconfig: './tsconfig.build.json',
        declaration: false, // 禁用Rollup生成声明文件，使用tsc单独生成
        sourceMap: false,
      }),
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
  },
  // CommonJS版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.cjs.js',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [
      ...sharedConfig.plugins,
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
  },
  // UMD版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.umd.js',
      format: 'umd',
      name: 'TimelineEngine',
      sourcemap: true,
    },
    plugins: [
      ...sharedConfig.plugins,
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
  },
  // UMD压缩版本
  {
    ...sharedConfig,
    output: {
      file: 'dist/index.umd.min.js',
      format: 'umd',
      name: 'TimelineEngine',
      sourcemap: true,
    },
    plugins: [
      ...sharedConfig.plugins,
      terser({
        compress: {
          drop_console: true,
        },
      }),
    ],
  },
];

export default isDev ? devConfig : prodConfig;