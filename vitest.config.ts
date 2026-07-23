import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@ai/core": path.resolve(__dirname, "ai/core/index.ts"),
      "@ai": path.resolve(__dirname, "ai"),
      "@config": path.resolve(__dirname, "config"),
      "@storage": path.resolve(__dirname, "storage"),
    },
  },
});
