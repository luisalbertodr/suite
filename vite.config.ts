import { defineConfig, type Plugin, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";
import legacy from "@vitejs/plugin-legacy";
import fs from "node:fs";
import path from "node:path";
import type { IncomingMessage, ServerResponse } from "node:http";

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

const DEFAULT_STYLE_PHOTOS_DIR = "C:\\Style-Dunasoft\\Fotografias";
const STYLE_PHOTOS_ROUTE = "/style-fotos";

const IMAGE_EXTENSIONS = new Set([
  ".bmp",
  ".jpg",
  ".jpeg",
  ".png",
  ".gif",
  ".webp",
  ".BMP",
  ".JPG",
  ".JPEG",
  ".PNG",
  ".GIF",
  ".WEBP",
]);

function contentTypeFor(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".bmp") return "image/bmp";
  if (ext === ".png") return "image/png";
  if (ext === ".gif") return "image/gif";
  if (ext === ".webp") return "image/webp";
  return "image/jpeg";
}

function stylePhotosPlugin(): Plugin {
  const photosDir = process.env.STYLE_PHOTOS_DIR ?? DEFAULT_STYLE_PHOTOS_DIR;

  const servePhoto = (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url ?? "";
    if (!url.startsWith(`${STYLE_PHOTOS_ROUTE}/`)) {
      next();
      return;
    }

    const rawName = decodeURIComponent(url.slice(STYLE_PHOTOS_ROUTE.length + 1).split("?")[0] ?? "");
    const filename = path.basename(rawName);
    if (!filename || filename.includes("..")) {
      res.statusCode = 400;
      res.end("Bad request");
      return;
    }

    const direct = path.join(photosDir, filename);
    const candidates = [direct];
    const stem = path.parse(filename).name;
    for (const ext of IMAGE_EXTENSIONS) {
      candidates.push(path.join(photosDir, `${stem}${ext}`));
    }

    const filePath = candidates.find((candidate) => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
    if (!filePath) {
      res.statusCode = 404;
      res.end("Not found");
      return;
    }

    res.setHeader("Content-Type", contentTypeFor(filePath));
    res.setHeader("Cache-Control", "public, max-age=3600");
    fs.createReadStream(filePath).pipe(res);
  };

  return {
    name: "style-photos-static",
    configureServer(server: ViteDevServer) {
      server.middlewares.use(servePhoto);
    },
    configurePreviewServer(server) {
      server.middlewares.use(servePhoto);
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
    stylePhotosPlugin(),
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
