import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const timelineSourceDir = path.resolve(
  __dirname,
  "../../../ViteCutTimeline/packages/timeline/src",
);

// https://vite.dev/config/
export default defineConfig({
  // 从 monorepo 根目录加载 .env，与 API 共用 .env.local
  envDir: path.resolve(__dirname, "../.."),
  plugins: [react()],
  // 自定义域名下直接部署在根路径，因此固定为 "/"
  base: "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@vitecut/canvas": path.resolve(__dirname, "../@vitecut/canvas/src"),
      "@vitecut/hotkeys": path.resolve(__dirname, "../@vitecut/hotkeys/src"),
      "@vitecut/utils": path.resolve(__dirname, "../@vitecut/utils/src"),
      "@vitecut/record": path.resolve(__dirname, "../@vitecut/record/src"),
      "@vitecut/timeline": path.resolve(timelineSourceDir, "index.ts"),
    },
    dedupe: ["react", "react-dom"],
  },
  optimizeDeps: {
    include: ["wavesurfer.js"],
    exclude: ["@vitecut/timeline"],
  },
  server: {
    fs: {
      allow: [
        path.resolve(__dirname, "../.."),
        path.resolve(__dirname),
        timelineSourceDir,
      ],
    },
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/output": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
    },
  },
});
