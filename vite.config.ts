import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";
import fs from "fs";

/**
 * Legacy Babel targets: por debajo de Chrome 80 / Safari 13.1 para forzar
 * transpile de `?.` / `??`. El dual-build sirve módulos ES a navegadores
 * modernos y SystemJS a los antiguos.
 */
const LEGACY_BROWSER_TARGETS = [
  "Chrome >= 63",
  "Edge >= 79",
  "Firefox >= 67",
  "Safari >= 11",
  "iOS >= 11",
];

/**
 * Safari ≤15 no aborta el módulo padre cuando falla un `import 'data:...'`
 * (vite#22008). Mover el chequeo de import.meta.resolve al hilo inline.
 */
function fixSafariLegacyDetect(): Plugin {
  const nestedResolveCheck =
    /import'data:text\/javascript,(?:[^']*?;)?if\(!import\.meta\.resolve\)throw Error\("import\.meta\.resolve not supported"\)';/g;
  const inlineResolveCheck =
    'if(typeof import.meta.resolve!="function")throw Error("import.meta.resolve not supported");';

  return {
    name: "fix-safari-legacy-detect",
    apply: "build",
    enforce: "post",
    transformIndexHtml(html) {
      if (!nestedResolveCheck.test(html)) return html;
      nestedResolveCheck.lastIndex = 0;
      return html.replace(nestedResolveCheck, inlineResolveCheck);
    },
    writeBundle(_opts, _bundle) {
      // transformIndexHtml a veces no ve el HTML final con tags inyectados;
      // reescribe dist/index.html tras el write.
      const outDir = path.resolve(process.cwd(), "dist");
      const indexPath = path.join(outDir, "index.html");
      if (!fs.existsSync(indexPath)) return;
      let html = fs.readFileSync(indexPath, "utf8");
      nestedResolveCheck.lastIndex = 0;
      if (nestedResolveCheck.test(html)) {
        nestedResolveCheck.lastIndex = 0;
        html = html.replace(nestedResolveCheck, inlineResolveCheck);
      }
      // Quitar crossorigin de scripts legacy: en Safari antiguo + nginx sin ACAO
      // puede bloquear el boot clásico.
      html = html.replace(
        /(<script\b[^>]*\bid="vite-legacy-(?:polyfill|entry)"[^>]*)\scrossorigin(?:="[^"]*")?/gi,
        "$1"
      );
      fs.writeFileSync(indexPath, html, "utf8");
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
        "core-js/modules/es.array.at.js",
        "core-js/modules/es.string.at.js",
      ],
    }),
    fixSafariLegacyDetect(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
