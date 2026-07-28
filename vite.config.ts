import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

/**
 * Targets más amplios que el default de Vite 8 (`baseline-widely-available` =
 * Chrome 111 / Safari 16.4). Clínicas siguen usando Chrome/Edge/Safari algo
 * anteriores; sin esto el bundle moderno deja la UI en blanco.
 */
const BROWSER_TARGETS = [
  "defaults",
  "Chrome >= 87",
  "Edge >= 88",
  "Firefox >= 78",
  "Safari >= 14",
  "iOS >= 14",
];

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
  plugins: [
    react(),
    legacy({
      targets: BROWSER_TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
