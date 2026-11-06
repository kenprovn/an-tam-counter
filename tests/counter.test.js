import test from "node:test";
import assert from "node:assert/strict";
import { createCounter } from "../src/utils/counter.js";
import {
  parseData,
  validCount,
  sanitizeSettings,
  saveData,
  loadData,
} from "../src/utils/storage.js";
import { numberText, audioPath } from "../src/audio/numbers.js";
test("100 rapid increments, 80→100 boundaries and continue beyond 100", () => {
  const seen = [];
  const counter = createCounter(0, (count) => seen.push(count));
  for (let i = 0; i < 100; i++) counter.add(1);
  assert.deepEqual(
    seen,
    Array.from({ length: 100 }, (_, i) => i + 1),
  );
  counter.add(1);
  assert.equal(counter.value, 101);
  counter.add(-1);
  assert.equal(counter.value, 100);
  counter.set(1);
  counter.set(80);
  assert.equal(counter.value, 80);
  counter.undo();
  assert.equal(counter.value, 1);
  counter.set(0);
  assert.equal(counter.add(-1), false);
});
test("reject invalid numbers and safe integer overflow", () => {
  for (const value of [
    -1,
    1.2,
    "",
    " ",
    "2e2",
    "0x10",
    "abc",
    NaN,
    Infinity,
    null,
    true,
    {},
    Number.MAX_SAFE_INTEGER + 1,
  ])
    assert.equal(validCount(value), null, String(value));
  const counter = createCounter(Number.MAX_SAFE_INTEGER);
  assert.equal(counter.add(1), false);
  assert.equal(counter.value, Number.MAX_SAFE_INTEGER);
});
test("number-only English texts and exact zero-padded paths", () => {
  for (const [n, text] of [
    [1, "One"],
    [2, "Two"],
    [3, "Three"],
    [10, "Ten"],
    [27, "Twenty-seven"],
    [80, "Eighty"],
    [99, "Ninety-nine"],
    [100, "One hundred"],
  ])
    assert.equal(numberText(n), text);
  assert.equal(audioPath(1), "/audio/sonia/001.mp3");
  assert.equal(audioPath(80), "/audio/sonia/080.mp3");
  assert.equal(audioPath(100), "/audio/sonia/100.mp3");
});
test("persist count/settings and tolerate corrupted or denied storage", () => {
  const storage = {
    value: null,
    getItem() {
      return this.value;
    },
    setItem(key, value) {
      this.value = value;
    },
  };
  assert.equal(
    saveData(
      { count: 80, settings: { volume: 0.5, rate: 1.25, theme: "green" } },
      storage,
    ),
    true,
  );
  assert.equal(loadData(storage).count, 80);
  assert.equal(loadData(storage).settings.theme, "green");
  storage.value = "{broken";
  assert.equal(loadData(storage).count, 0);
  assert.equal(
    saveData(
      {},
      {
        setItem() {
          throw new Error();
        },
      },
    ),
    false,
  );
  assert.throws(() => parseData('{"count":-1}'));
  const safe = sanitizeSettings({
    rate: 99,
    volume: -4,
    theme: "__proto__",
    goal: -1,
  });
  assert.equal(safe.rate, 1);
  assert.equal(safe.volume, 0);
  assert.equal(safe.theme, "purple");
  assert.equal(safe.goal, 100);
});
