import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";

export default defineConfig({
  plugins: [vue()],
  // 相对路径产物，可部署到任意子路径（/lst/）
  base: "./",
  build: {
    outDir: "dist",
    // 产物目录名与 Flask 的 /static 路由对齐，部署时直接拷进 /opt/wkeelilist/static
    assetsDir: "static",
    emptyOutDir: true,
  },
  server: {
    // 本地开发时把 API 代理到本机 Flask（127.0.0.1:8330）
    proxy: {
      "/api": "http://127.0.0.1:8330",
    },
  },
});
