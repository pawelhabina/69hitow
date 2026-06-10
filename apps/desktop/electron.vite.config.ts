import react from "@vitejs/plugin-react";
import { defineConfig, externalizeDepsPlugin } from "electron-vite";
import { resolve } from "node:path";

export default defineConfig({
  main: {
    envDir: resolve(__dirname, "../.."),
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/main.ts")
      }
    }
  },
  preload: {
    envDir: resolve(__dirname, "../.."),
    plugins: [externalizeDepsPlugin()],
    build: {
      rollupOptions: {
        input: resolve(__dirname, "electron/preload.ts")
      }
    }
  },
  renderer: {
    root: __dirname,
    envDir: resolve(__dirname, "../.."),
    plugins: [react()],
    resolve: {
      alias: {
        "@": resolve(__dirname, "src")
      }
    },
    build: {
      rollupOptions: {
        input: resolve(__dirname, "index.html")
      }
    },
    server: {
      port: 5173,
      strictPort: false
    }
  }
});
