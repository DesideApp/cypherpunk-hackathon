import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import svgr from "vite-plugin-svgr"; // ✅ Importa el plugin
import { resolve } from "path";

const backendUrl =
  process.env.VITE_BACKEND_URL || (process.env.NODE_ENV === "production"
    ? "https://backend-deside.onrender.com"
    : "http://localhost:3001");

const isProduction = process.env.NODE_ENV === "production";

export default defineConfig({
  root: "./",
  plugins: [
    react(),
    svgr(), // ✅ Añade el plugin a la lista
  ],
  define: {
    "process.env.NODE_ENV": JSON.stringify(process.env.NODE_ENV),
  },
  build: {
    target: "modules",
    minify: isProduction,
    rollupOptions: {
      output: {
        format: "esm",
        manualChunks: {
          solana: ["@solana/web3.js"],
        },
      },
      onwarn(warning, warn) {
        if (warning.code === "DYNAMIC_IMPORT_VARIABLE") return;
        warn(warning);
      },
    },
    chunkSizeWarningLimit: 800,
  },
  base: isProduction ? "/" : "/",
  resolve: {
    alias: {
      "@": resolve(__dirname, "src"),
      "@wallet-adapter": resolve(__dirname, "src/adapters/wallet-adapter"),
      "@features": resolve(__dirname, "src/features"),
      "@adapters": resolve(__dirname, "src/adapters"),
      "@shared": resolve(__dirname, "src/shared"),
      "@components": resolve(__dirname, "src/components"),
      "@pages": resolve(__dirname, "src/pages"),
      "@main": resolve(__dirname, "src/main"),
      "@Layout": resolve(__dirname, "src/Layout"),
      "@utils": resolve(__dirname, "src/utils"),
    },
    // Evita copias duplicadas de React que provocan "Invalid hook call"
    dedupe: ["react", "react-dom"],
    extensions: [".js", ".jsx", ".ts", ".tsx"],
  },
  optimizeDeps: {
  include: ["buffer", "@solana/web3.js"],
  },
  server: {
    host: "localhost",
    port: Number(process.env.VITE_DEV_SERVER_PORT || 3000),
    strictPort: true,
    open: "http://localhost:3000/",
    proxy: {
      "/api": {
        target: backendUrl,
        changeOrigin: true,
        secure: isProduction,
        rewrite: (path) => path.replace(/^\/api/, "/api"),
      },
      "/socket.io": {
        target: backendUrl,
        ws: true,
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/socket.io/, "/socket.io"),
      },
    },
  },
});
