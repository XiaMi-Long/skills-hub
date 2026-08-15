import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

/** 官网截图专用构建:把 .shot/index.html(mock Tauri IPC 的应用)打包成纯静态页 */
export default defineConfig({
  plugins: [react(), tailwindcss()],
  base: "./",
  build: {
    outDir: ".shot/dist",
    emptyOutDir: true,
    rollupOptions: {
      input: fileURLToPath(new URL(".shot/index.html", import.meta.url)),
    },
  },
});
