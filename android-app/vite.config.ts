// Standalone build used only for the Android app (Capacitor).
// The Lovable website keeps using the root vite.config.ts — nothing here affects it.
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const here = (p: string) => fileURLToPath(new URL(p, import.meta.url));

export default defineConfig({
  root: here("."),
  base: "./",
  publicDir: here("../public"),
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { "@": here("../src") },
    dedupe: ["react", "react-dom", "@tanstack/react-router"],
  },
  build: { outDir: here("dist"), emptyOutDir: true },
});
