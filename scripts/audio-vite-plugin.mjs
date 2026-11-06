import { readFile, readdir } from "node:fs/promises";
import { prepareLibrary, audioDirectory } from "./audio-library.mjs";

export function audioLibraryPlugin() {
  let server,
    timer,
    running = Promise.resolve();
  return {
    name: "local-sonia-library",
    async configureServer(vite) {
      server = vite;
      await prepareLibrary();
      const update = (path) => {
        const normalized = path.replaceAll("\\", "/");
        if (
          !normalized.includes("/public/audio/sonia/") ||
          !/\.mp3$/i.test(path)
        )
          return;
        clearTimeout(timer);
        timer = setTimeout(() => {
          running = running
            .then(async () => {
              await prepareLibrary();
              server.ws.send({ type: "full-reload" });
            })
            .catch((error) => server.config.logger.error(error.message));
        }, 300);
      };
      server.watcher
        .on("add", update)
        .on("change", update)
        .on("unlink", update);
      server.httpServer?.once("close", () => {
        clearTimeout(timer);
        server.watcher
          .off("add", update)
          .off("change", update)
          .off("unlink", update);
      });
    },
    async generateBundle() {
      const { manifest } = await prepareLibrary();
      // Public copying is disabled for builds: only validated MP3s enter dist.
      const root = new URL("../public/", import.meta.url);
      const copy = async (directory, prefix = "") => {
        for (const entry of await readdir(directory, { withFileTypes: true })) {
          const name = prefix + entry.name;
          if (name === "audio/sonia") continue;
          if (entry.isDirectory())
            await copy(new URL(entry.name + "/", directory), name + "/");
          else if (entry.isFile())
            this.emitFile({
              type: "asset",
              fileName: name,
              source: await readFile(new URL(entry.name, directory)),
            });
        }
      };
      await copy(root);
      this.emitFile({
        type: "asset",
        fileName: "audio/sonia/manifest.json",
        source: JSON.stringify(manifest, null, 2) + "\n",
      });
      for (const number of manifest.files) {
        const name = `${String(number).padStart(3, "0")}.mp3`;
        this.emitFile({
          type: "asset",
          fileName: "audio/sonia/" + name,
          source: await readFile(new URL(name, audioDirectory)),
        });
      }
    },
  };
}
