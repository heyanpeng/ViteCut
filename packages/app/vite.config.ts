import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  base: process.env.GITHUB_PAGES ? "/SwiftAV/" : "/",
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "@swiftav/canvas": path.resolve(__dirname, "../@swiftav/canvas/src"),
      "@swiftav/utils": path.resolve(__dirname, "../@swiftav/utils/src"),
      "@swiftav/record": path.resolve(__dirname, "../@swiftav/record/src"),
    },
  },
  optimizeDeps: {
    include: ["wavesurfer.js"],
  },
});
