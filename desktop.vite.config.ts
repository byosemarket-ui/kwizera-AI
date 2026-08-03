import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: "desktop",
  plugins: [react()],
  base: "/desktop/",
  build: { outDir: "../dev/ui/desktop", emptyOutDir: true },
});