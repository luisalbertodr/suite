import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
    // Evita “Blocked request. This host is not allowed” al abrir el dev server por lipoout.com (proxy/túnel).
    allowedHosts: ["lipoout.com", "www.lipoout.com", ".lipoout.com"],
  },
  preview: {
    host: "::",
    port: 8080,
    allowedHosts: ["lipoout.com", "www.lipoout.com", ".lipoout.com"],
  },
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
