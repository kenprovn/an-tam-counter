import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { audioLibraryPlugin } from "./scripts/audio-vite-plugin.mjs";
export default defineConfig(({ command }) => ({
  publicDir: command === "build" ? false : "public",
  plugins: [react(), audioLibraryPlugin()],
}));
