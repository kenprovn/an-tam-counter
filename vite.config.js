import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { audioLibraryPlugin } from "./scripts/audio-vite-plugin.mjs";
import { audioMode } from "./scripts/audio-publication.mjs";
export default defineConfig(({ command }) => ({
  publicDir: command === "build" ? false : "public",
  // Vite must not implicitly copy public/: the plugin enforces publication policy.
  plugins: [react(), audioLibraryPlugin({ mode: audioMode() })],
}));
