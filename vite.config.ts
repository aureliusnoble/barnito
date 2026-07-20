import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

// Deployed under https://<user>.github.io/barnito/ so assets need the /barnito/ base.
// Override with BARNITO_BASE for custom domains (e.g. "/").
const base = process.env.BARNITO_BASE || "/barnito/";

export default defineConfig({
  base,
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  build: {
    rollupOptions: {
      // Two apps, one repo: the World Cup 2026 site at / and the Euro 2028 game at /euro/.
      input: {
        main: fileURLToPath(new URL("./index.html", import.meta.url)),
        euro: fileURLToPath(new URL("./euro/index.html", import.meta.url)),
      },
    },
  },
});
