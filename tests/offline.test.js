import test from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
const source = await readFile(
  new URL("../scripts/sw-template.js", import.meta.url),
  "utf8",
);
function worker() {
  const events = {},
    saved = new Map();
  let network = 0;
  const cache = {
    async match(key) {
      return saved.get(key)?.clone();
    },
    async put(key, response) {
      saved.set(key, response);
    },
    async addAll() {},
  };
  const context = {
    self: {
      addEventListener(name, handler) {
        events[name] = handler;
      },
      location: { origin: "https://test.local" },
      clients: { claim: async () => {} },
    },
    caches: { open: async () => cache },
    SHELL_CACHE: "shell",
    AUDIO_CACHE: "sonia",
    PRECACHE: ["/index.html", "/assets/app.js"],
    Response,
    URL,
    fetch: async () => {
      network++;
      throw new Error("Offline");
    },
  };
  vm.runInNewContext(source, context);
  async function request(url, options = {}) {
    let result;
    events.fetch({
      request: {
        url: "https://test.local" + url,
        method: "GET",
        headers: new Headers(options.headers),
        mode: options.mode,
      },
      respondWith(value) {
        result = value;
      },
    });
    return result;
  }
  return {
    saved,
    request,
    get network() {
      return network;
    },
  };
}
test("offline navigation and app assets come from precached shell", async () => {
  const s = worker();
  s.saved.set("/index.html", new Response("<html>counter</html>"));
  s.saved.set("/assets/app.js", new Response("app"));
  assert.equal(
    await (await s.request("/", { mode: "navigate" })).text(),
    "<html>counter</html>",
  );
  assert.equal(await (await s.request("/assets/app.js")).text(), "app");
  assert.equal(s.network, 0);
});
test("offline cached MP3 supports Chrome byte ranges and suffix ranges", async () => {
  const s = worker();
  s.saved.set(
    "https://test.local/audio/sonia/027.mp3",
    new Response("0123456789", { headers: { "Content-Type": "audio/mpeg" } }),
  );
  const response = await s.request("/audio/sonia/027.mp3", {
    headers: { range: "bytes=2-5" },
  });
  assert.equal(response.status, 206);
  assert.equal(response.headers.get("content-range"), "bytes 2-5/10");
  assert.equal(await response.text(), "2345");
  assert.equal(
    await (
      await s.request("/audio/sonia/027.mp3", {
        headers: { range: "bytes=-3" },
      })
    ).text(),
    "789",
  );
  assert.equal(
    (
      await s.request("/audio/sonia/027.mp3", {
        headers: { range: "bytes=20-" },
      })
    ).status,
    416,
  );
  assert.equal(s.network, 0);
});
