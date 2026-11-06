import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  writeFile,
  rm,
  readdir,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve, dirname, basename } from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createServer } from "node:http";
import vm from "node:vm";
import { build } from "vite";
import react from "@vitejs/plugin-react";
import { MPEGDecoder } from "mpg123-decoder";
import { tone, silence } from "./fixtures/audio-fixtures.js";
import { inspectLibrary } from "../scripts/audio-library.mjs";
import { audioLibraryPlugin } from "../scripts/audio-vite-plugin.mjs";
import { buildOffline } from "../scripts/build-sw.mjs";
import {
  audioMode,
  prepareDeployment,
  publicationDraft,
  validatePublication,
  verifyDeployment,
} from "../scripts/audio-publication.mjs";
import { verifyLibrary } from "../src/audio/library.js";

async function fixture(t) {
  const path = await mkdtemp(join(tmpdir(), "an-tam-publication-test-"));
  t.after(() => {
    const target = resolve(path);
    assert.equal(dirname(target), resolve(tmpdir()));
    assert.ok(basename(target).startsWith("an-tam-publication-test-"));
    return rm(target, { recursive: true, force: true });
  });
  const root = pathToFileURL(path + "/");
  const directory = new URL("audio/", root);
  const rightsPath = new URL("rights.json", root);
  await mkdir(directory);
  await Promise.all(
    Array.from({ length: 100 }, (_, i) =>
      writeFile(
        new URL(`${String(i + 1).padStart(3, "0")}.mp3`, directory),
        tone,
      ),
    ),
  );
  const { manifest } = await inspectLibrary(directory);
  const record = publicationDraft(manifest);
  // Test-only self-generated tone, not speech or output from Microsoft.
  record.permission = {
    confirmed: true,
    allowsPublicHosting: true,
    basis: "written-permission",
    reference: "TEST ONLY: self-generated synthetic signal; not Sonia audio",
    confirmedBy: "automated test fixture",
    confirmedAt: "2026-11-07T00:00:00Z",
  };
  await writeFile(rightsPath, JSON.stringify(record));
  return { root, directory, rightsPath, record, manifest };
}

test("private deployment cannot leak source MP3s or its nonempty manifest", async (t) => {
  const options = await fixture(t);
  const source = JSON.stringify(options.manifest);
  await writeFile(new URL("manifest.json", options.directory), source);
  const result = await prepareDeployment({ ...options, mode: "private" });
  assert.equal(result.manifest.deploymentMode, "private");
  assert.equal(result.manifest.revision, "empty");
  assert.deepEqual(result.manifest.files, []);
  assert.equal(
    await readFile(new URL("manifest.json", options.directory), "utf8"),
    source,
  );
  assert.deepEqual(await readFile(new URL("001.mp3", options.directory)), tone);
  assert.throws(() => audioMode("pubilc"), /không hợp lệ/);
});

test("public deployment requires explicit rights bound to all 100 file hashes", async (t) => {
  const options = await fixture(t);
  const pending = publicationDraft(options.manifest);
  assert.throws(
    () => validatePublication(pending, options.manifest),
    /thiếu xác nhận quyền/,
  );
  await assert.rejects(
    prepareDeployment({
      ...options,
      mode: "public",
      rightsPath: new URL("absent.json", options.root),
    }),
    /build bị chặn/,
  );
  for (const field of ["reference", "confirmedBy", "confirmedAt", "basis"]) {
    const record = structuredClone(options.record);
    record.permission[field] = "";
    assert.throws(
      () => validatePublication(record, options.manifest),
      /thiếu xác nhận quyền/,
    );
  }
  const wrong = structuredClone(options.record);
  wrong.files["027.mp3"] = "0".repeat(64);
  assert.throws(
    () => validatePublication(wrong, options.manifest),
    /không khớp SHA-256/,
  );
  const result = await prepareDeployment({ ...options, mode: "public" });
  assert.equal(result.manifest.files.length, 100);
  assert.equal(result.manifest.deploymentMode, "public");
});

test("public mode fails on missing, invalid or unexpected MP3 instead of building 0/100", async (t) => {
  const options = await fixture(t);
  await assert.rejects(
    prepareDeployment({
      ...options,
      mode: "public",
      directory: new URL("absent/", options.root),
    }),
    /Public audio:.*100\/100.*build bị chặn/,
  );
  await rm(new URL("100.mp3", options.directory));
  await assert.rejects(
    prepareDeployment({ ...options, mode: "public" }),
    /99\/100.*100\.mp3/,
  );
  await writeFile(new URL("100.mp3", options.directory), silence);
  await assert.rejects(
    prepareDeployment({ ...options, mode: "public" }),
    /99\/100.*100\.mp3/,
  );
  await writeFile(new URL("100.mp3", options.directory), tone);
  await writeFile(new URL("extra.mp3", options.directory), tone);
  await assert.rejects(
    prepareDeployment({ ...options, mode: "public" }),
    /extra\.mp3/,
  );
});

test("real Vite builds enforce both modes; public URLs, preload, offline MP3 and build-info agree", async (t) => {
  const options = await fixture(t);
  const buildTo = async (mode) => {
    const out = new URL(`${mode}/`, options.root);
    await build({
      configFile: false,
      root: fileURLToPath(new URL("../", import.meta.url)),
      publicDir: false,
      plugins: [react(), audioLibraryPlugin({ ...options, mode })],
      logLevel: "silent",
      build: { outDir: fileURLToPath(out), emptyOutDir: false },
    });
    await buildOffline({ root: out, mode, commit: "a".repeat(40) });
    const manifest = await verifyDeployment(out, mode);
    const info = JSON.parse(
      await readFile(new URL("build-info.json", out), "utf8"),
    );
    assert.equal(info.audioFiles, manifest.files.length);
    assert.equal(info.audioRevision, manifest.revision);
    assert.equal(info.audioMode, mode);
    return { out, manifest };
  };
  const privateBuild = await buildTo("private");
  assert.equal(
    (await readdir(new URL("audio/sonia/", privateBuild.out))).filter((s) =>
      s.endsWith(".mp3"),
    ).length,
    0,
  );
  const { out, manifest } = await buildTo("public");
  assert.equal(
    (await readdir(new URL("audio/sonia/", out))).filter((s) =>
      s.endsWith(".mp3"),
    ).length,
    100,
  );
  // Serve the actual emitted artifact, not an in-memory substitute for its files.
  const server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, "http://localhost").pathname;
      if (!/^\/audio\/sonia\/(?:\d{3}\.mp3|manifest\.json)$/.test(path))
        throw new Error("404");
      const bytes = await readFile(new URL(path.slice(1), out));
      response.writeHead(200, {
        "Content-Type": path.endsWith(".mp3")
          ? "audio/mpeg"
          : "application/json",
      });
      response.end(bytes);
    } catch {
      response.writeHead(404);
      response.end();
    }
  });
  await new Promise((done) => server.listen(0, "127.0.0.1", done));
  t.after(() => {
    server.closeAllConnections();
    server.close();
  });
  const origin = `http://127.0.0.1:${server.address().port}`;
  for (const number of [1, 27, 80, 100]) {
    const response = await fetch(
      `${origin}/audio/sonia/${String(number).padStart(3, "0")}.mp3`,
    );
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("content-type"), "audio/mpeg");
    assert.deepEqual(Buffer.from(await response.arrayBuffer()), tone);
  }
  const saved = new Map();
  const keyOf = (key) => new URL(key, origin).href;
  const cache = {
    match: async (key) => saved.get(keyOf(key))?.clone(),
    put: async (key, value) => {
      saved.set(keyOf(key), value.clone());
    },
    delete: async (key) => saved.delete(keyOf(key)),
  };
  const caches = { open: async () => cache };
  const decoder = new MPEGDecoder();
  await decoder.ready;
  t.after(() => decoder.free());
  const decode = async (buffer) => {
    await decoder.reset();
    const pcm = decoder.decode(new Uint8Array(buffer));
    assert.equal(pcm.errors.length, 0);
    return {
      numberOfChannels: pcm.channelData.length,
      sampleRate: pcm.sampleRate,
      getChannelData: (i) => pcm.channelData[i],
    };
  };
  // One worker owns this decoder; production browser uses decodeAudioData.
  let decoding = Promise.resolve();
  const result = await verifyLibrary(manifest, {
    cacheStorage: caches,
    fetcher: (path) => fetch(origin + path),
    decode: (buffer) => {
      const next = decoding.then(() => decode(buffer));
      decoding = next;
      return next;
    },
  });
  assert.equal(result.cached, 100);
  server.closeAllConnections();
  await new Promise((done) => server.close(done));
  const events = {};
  let network = 0;
  vm.runInNewContext(await readFile(new URL("sw.js", out), "utf8"), {
    self: {
      addEventListener: (name, fn) => {
        events[name] = fn;
      },
      location: { origin },
    },
    caches,
    URL,
    Response,
    fetch: () => {
      network++;
      throw new Error("Offline: origin server stopped");
    },
  });
  for (let number = 1; number <= 100; number++) {
    let response;
    events.fetch({
      request: {
        url: `${origin}/audio/sonia/${String(number).padStart(3, "0")}.mp3`,
        method: "GET",
        headers: new Headers(),
      },
      respondWith: (value) => {
        response = value;
      },
    });
    const bytes = await (await response).arrayBuffer();
    assert.deepEqual(Buffer.from(bytes), tone);
    assert.ok(
      (await decode(bytes)).getChannelData(0).some((sample) => sample !== 0),
    );
  }
  assert.equal(network, 0);
  await writeFile(new URL("audio/sonia/027.mp3", out), silence);
  await assert.rejects(
    verifyDeployment(out, "public"),
    /thay đổi sau khi kiểm tra/,
  );
  await assert.rejects(verifyDeployment(out, "private"), /không nhất quán/);
});
