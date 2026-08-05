import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import path from "path";

/**
 * Targets más amplios que el default de Vite 8 (`baseline-widely-available` =
 * Chrome 111 / Safari 16.4). Clínicas siguen usando Chrome/Edge/Safari algo
 * anteriores; sin esto el bundle moderno deja la UI en blanco.
 */
const BROWSER_TARGETS = [
  "Chrome >= 87",
  "Edge >= 88",
  "Firefox >= 78",
  "Safari >= 14",
  "iOS >= 14",
];

/**
 * Safari ≤15 (y algunos WebKit) no detienen el módulo padre cuando un
 * `import 'data:...'` lanza — bug Vite #22008. El chequeo de
 * `import.meta.resolve` queda en un data-URL y el flag modern se pone a true
 * igual, así que nunca cargan los chunks legacy y la UI queda en blanco.
 * Forzar el throw en el hilo del módulo inline sí aborta la ejecución.
 */
function fixSafariLegacyDetect(): Plugin {
  const nestedResolveCheck =
    /import'data:text\/javascript,(?:[^']*?;)?if\(!import\.meta\.resolve\)throw Error\("import\.meta\.resolve not supported"\)';/g;
  const inlineResolveCheck =
    'if(typeof import.meta.resolve!="function")throw Error("import.meta.resolve not supported");';

  return {
    name: "fix-safari-legacy-detect",
    enforce: "post",
    transformIndexHtml(html) {
      if (!nestedResolveCheck.test(html)) return html;
      nestedResolveCheck.lastIndex = 0;
      return html.replace(nestedResolveCheck, inlineResolveCheck);
    },
  };
}

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
      // Babel/SystemJS para navegadores sin ES modules / sin import.meta.resolve.
      targets: BROWSER_TARGETS,
      // Sin esto, plugin-legacy fija build.target a Chrome 105 / Safari 16.4
      // y los “modernos a medias” (p. ej. Safari 15 marcado mal) reciben
      // sintaxis que no entienden → pantalla en blanco.
      modernTargets: BROWSER_TARGETS,
      modernPolyfills: true,
      renderLegacyChunks: true,
    }),
    fixSafariLegacyDetect(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
