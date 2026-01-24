import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? '/SwiftAV/' : '/',
  resolve: {
    alias: {
      // 开发时使用源码，生产构建时使用构建后的包（通过 workspace 协议自动解析）
      '@swiftav/sdk': path.resolve(__dirname, '../swiftav-sdk/src'),
    },
  },
});
