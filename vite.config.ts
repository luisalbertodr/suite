import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import fs from "fs";

/**
 * Clínicas usan Chrome/Safari anteriores a Chrome 105 / Safari 16.4.
 * El dual-build de Vite 8 deja la UI en blanco ahí (detector import.meta.resolve
 * + bundle moderno). Generamos ambos artefactos (el paso moderno emite el CSS)
 * y reescribimos el HTML final para que TODOS carguen solo SystemJS/legacy.
 */
const BROWSER_TARGETS = [
  "Chrome >= 87",
  "Edge >= 88",
  "Firefox >= 78",
  "Safari >= 14",
  "iOS >= 14",
];

function rewriteIndexHtmlToSystemJsOnly(html: string): string {
  const polyfillSrc = html.match(
    /id="vite-legacy-polyfill"[^>]*\ssrc="([^"]+)"|src="([^"]+)"[^>]*\sid="vite-legacy-polyfill"/
  );
  const entrySrc = html.match(
    /id="vite-legacy-entry"[^>]*\sdata-src="([^"]+)"|data-src="([^"]+)"[^>]*\sid="vite-legacy-entry"/
  );
  const poly = polyfillSrc?.[1] || polyfillSrc?.[2];
  const entry = entrySrc?.[1] || entrySrc?.[2];
  if (!poly || !entry) {
    throw new Error(
      "[force-systemjs-for-all-browsers] No se encontraron chunks legacy en index.html"
    );
  }

  const cssLinks = Array.from(
    html.matchAll(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi)
  ).map((m) => m[0]);

  let out = html
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*\/>/gi, "")
    .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, "")
    .replace(/<script\b[^>]*\bnomodule\b[^>]*>[\s\S]*?<\/script>/gi, "");

  if (cssLinks.length && !/<link\b[^>]*\brel=["']stylesheet["']/i.test(out)) {
    out = out.replace(/<\/head>/i, `    ${cssLinks.join("\n    ")}\n  </head>`);
  }

  // Evitar duplicar si ya reescribimos.
  out = out
    .replace(/<script\b[^>]*\sid="vite-legacy-polyfill"[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\sid="vite-legacy-entry"[^>]*>[\s\S]*?<\/script>/gi, "");

  const boot = [
    `    <script crossorigin id="vite-legacy-polyfill" src="${poly}"><\/script>`,
    `    <script crossorigin id="vite-legacy-entry" data-src="${entry}">System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))<\/script>`,
  ].join("\n");

  if (!/<\/body>/i.test(out)) {
    throw new Error("[force-systemjs-for-all-browsers] index.html sin </body>");
  }
  return out.replace(/<\/body>/i, `${boot}\n  </body>`);
}

function forceSystemJsForAllBrowsers(): Plugin {
  let outDir = "dist";
  return {
    name: "force-systemjs-for-all-browsers",
    apply: "build",
    configResolved(config) {
      outDir = path.resolve(config.root, config.build.outDir);
    },
    // plugin-legacy hace dos pases; solo reescribimos cuando ya hay tags legacy.
    writeBundle() {
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath, "utf8");
      if (!html.includes("vite-legacy-polyfill") || !html.includes("vite-legacy-entry")) {
        return;
      }
      // Ya reescrito (sin type=module de app).
      if (
        !html.includes('type="module"') &&
        html.includes('id="vite-legacy-polyfill"') &&
        !html.includes("nomodule")
      ) {
        return;
      }
      const next = rewriteIndexHtmlToSystemJsOnly(html);
      fs.writeFileSync(indexPath, next, "utf8");
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig(() => ({
  server: {
    host: "::",
    port: 8080,
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
      renderModernChunks: true,
      polyfills: true,
      additionalLegacyPolyfills: ["regenerator-runtime/runtime"],
    }),
    forceSystemJsForAllBrowsers(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
