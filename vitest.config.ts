import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    testTimeout: 30000,
    hookTimeout: 30000,
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
