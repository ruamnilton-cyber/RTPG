import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "client/src")
    }
  },
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3333",
        changeOrigin: true
      },
      "/public": {
        target: "http://localhost:3333",
        changeOrigin: true
      }
    }
  },
  build: {
    outDir: "dist/client"
  }
});
