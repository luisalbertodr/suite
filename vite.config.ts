import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import fs from "fs";

/**
 * Targets Babel bajos para forzar transpile de `?.` / `??` en el bundle
 * SystemJS. Generamos también chunks modernos (emiten el CSS) y reescribimos
 * index.html para que TODOS los navegadores carguen solo SystemJS/legacy.
 *
 * Motivo: el dual-build deja que Safari/Chrome "a medias" (soportan
 * type=module pero no sintaxis actual) parseen el chunk moderno, fallen, y
 * con `crossorigin` + nginx sin ACAO el overlay solo muestre "Script error.".
 */
const LEGACY_BROWSER_TARGETS = [
  "Chrome >= 63",
  "Edge >= 79",
  "Firefox >= 67",
  "Safari >= 11",
  "iOS >= 11",
];

function stripCrossorigin(tag: string): string {
  return tag.replace(/\s+crossorigin(?:="[^"]*")?/gi, "");
}

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
  ).map((m) => stripCrossorigin(m[0]));

  let out = html
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\btype=["']module["'][^>]*\/>/gi, "")
    .replace(/<link\b[^>]*\brel=["']modulepreload["'][^>]*>/gi, "")
    .replace(/<script\b[^>]*\bnomodule\b[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<link\b[^>]*\brel=["']stylesheet["'][^>]*>/gi, "");

  if (cssLinks.length) {
    out = out.replace(/<\/head>/i, `    ${cssLinks.join("\n    ")}\n  </head>`);
  }

  out = out
    .replace(/<script\b[^>]*\sid="vite-legacy-polyfill"[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<script\b[^>]*\sid="vite-legacy-entry"[^>]*>[\s\S]*?<\/script>/gi, "");

  // Sin crossorigin: mismo origen + nginx sin ACAO → evita "Script error." enmascarado.
  const boot = [
    `    <script id="vite-legacy-polyfill" src="${poly}"><\/script>`,
    `    <script id="vite-legacy-entry" data-src="${entry}">System.import(document.getElementById('vite-legacy-entry').getAttribute('data-src'))<\/script>`,
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
    // plugin-legacy hace dos pases; reescribimos cuando ya hay tags legacy.
    writeBundle() {
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      const html = fs.readFileSync(indexPath, "utf8");
      if (!html.includes("vite-legacy-polyfill") || !html.includes("vite-legacy-entry")) {
        return;
      }
      if (
        !html.includes('type="module"') &&
        html.includes('id="vite-legacy-polyfill"') &&
        !html.includes("nomodule")
      ) {
        // Ya reescrito: solo asegurar sin crossorigin.
        const cleaned = html
          .replace(/(<script\b[^>]*)\s+crossorigin(?:="[^"]*")?/gi, "$1")
          .replace(/(<link\b[^>]*)\s+crossorigin(?:="[^"]*")?/gi, "$1");
        if (cleaned !== html) fs.writeFileSync(indexPath, cleaned, "utf8");
        return;
      }
      fs.writeFileSync(indexPath, rewriteIndexHtmlToSystemJsOnly(html), "utf8");
    },
  };
}

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
      targets: LEGACY_BROWSER_TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: true,
      renderModernChunks: true,
      polyfills: true,
      additionalLegacyPolyfills: [
        "regenerator-runtime/runtime",
        path.resolve(__dirname, "src/polyfills/resize-observer.ts"),
      ],
    }),
    forceSystemJsForAllBrowsers(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
