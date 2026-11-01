import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { resolve } from "node:path";
import { handleApi } from "./src/server/api.ts";

const api = (): Plugin => ({
  name: "carousel-api",
  configureServer(server) {
    server.middlewares.use("/api", async (req, res, next) => {
      const [path, qs] = (req.url ?? "").split("?");
      if (!(await handleApi(req, res, path, new URLSearchParams(qs)))) next();
    });
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), api()],
  resolve: { alias: { "@": resolve(import.meta.dirname, "src/web") } },
  root: "src/web",
  build: { outDir: resolve(import.meta.dirname, "dist"), emptyOutDir: true },
});
