import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath, URL } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@shared": fileURLToPath(new URL("./shared", import.meta.url)),
    },
  },
  test: {
    include: ["scripts/**/*.test.ts", "shared/**/*.test.ts", "src/**/*.test.{ts,tsx}"],
    environmentMatchGlobs: [["src/**", "jsdom"]],
  },
});
