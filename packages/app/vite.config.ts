import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
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
    },
  },
  optimizeDeps: {
    include: ["wavesurfer.js"],
  },
});
