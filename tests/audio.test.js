import test from "node:test";
import assert from "node:assert/strict";
import { NumberPlayer } from "../src/audio/player.js";
import { defaults } from "../src/config.js";
function setup() {
  const plays = [],
    utterances = [],
    statuses = [];
  let canceled = 0;
  const audio = {
    src: "",
    pause() {},
    removeAttribute() {
      this.src = "";
    },
    load() {},
    play() {
      plays.push(this.src);
      return Promise.resolve();
    },
  };
  const speech = {
    getVoices: () => [
      { name: "Device British", lang: "en-GB", localService: true },
    ],
    cancel() {
      canceled++;
    },
    speak(value) {
      utterances.push(value);
    },
    addEventListener() {},
    removeEventListener() {},
  };
  class Utterance {
    constructor(text) {
      this.text = text;
    }
  }
  const player = new NumberPlayer({
    audio,
    speech,
    Utterance,
    onStatus: (text) => statuses.push(text),
  });
  player.setFiles(Array.from({ length: 100 }, (_, i) => i + 1));
  return {
    player,
    audio,
    speech,
    plays,
    utterances,
    statuses,
    get canceled() {
      return canceled;
    },
  };
}
test("latest tap replaces previous audio; all 100 requests select correct files", () => {
  const s = setup();
  for (let i = 1; i <= 100; i++) s.player.speak(i, defaults);
  assert.equal(s.plays.length, 100);
  assert.equal(s.canceled, 100);
  assert.equal(s.audio.src, "/audio/sonia/100.mp3");
  assert.equal(s.plays[79], "/audio/sonia/080.mp3");
  assert.equal(s.utterances.length, 0);
  s.player.dispose();
});
test("mute, volume, playback speed and TTS outside range", () => {
  const s = setup();
  s.player.speak(27, { ...defaults, volume: 0.4, rate: 1.5 });
  assert.equal(s.audio.volume, 0.4);
  assert.equal(s.audio.playbackRate, 1.5);
  s.player.speak(28, { ...defaults, enabled: false });
  assert.equal(s.plays.length, 1);
  s.player.speak(101, defaults);
  assert.equal(s.utterances[0].text, "101");
  assert.equal(s.utterances[0].lang, "en-GB");
  assert.ok(s.statuses.at(-1).includes("Device British"));
  s.player.dispose();
});
test("missing real files never claim Sonia and obey fallback switch", () => {
  const s = setup();
  s.player.setFiles([]);
  s.player.speak(27, defaults);
  assert.equal(s.plays.length, 0);
  assert.equal(s.utterances[0].text, "Twenty-seven");
  s.player.speak(28, { ...defaults, fallback: false });
  assert.equal(s.utterances.length, 1);
  assert.match(s.statuses.at(-1), /Chưa có file/);
  s.player.dispose();
});
test("late playback rejection from old number cannot speak stale number", async () => {
  const s = setup();
  let reject;
  s.audio.play = () =>
    new Promise((resolve, fail) => {
      reject = fail;
    });
  s.player.speak(1, defaults);
  const oldReject = reject;
  s.audio.play = () => Promise.resolve();
  s.player.speak(2, defaults);
  oldReject(new Error("old request"));
  await Promise.resolve();
  assert.equal(s.utterances.length, 0);
  assert.equal(s.audio.src, "/audio/sonia/002.mp3");
  s.player.dispose();
});
test("current MP3 failure falls back, but browser blocking is reported", async () => {
  const s = setup();
  s.audio.play = () => Promise.reject(new Error("network"));
  s.player.speak(27, defaults);
  await Promise.resolve();
  assert.equal(s.utterances[0].text, "Twenty-seven");
  s.audio.play = () =>
    Promise.reject(Object.assign(new Error(), { name: "NotAllowedError" }));
  s.player.speak(28, defaults);
  await Promise.resolve();
  assert.equal(s.utterances.length, 1);
  assert.match(s.statuses.at(-1), /chặn âm thanh/);
  s.player.dispose();
});
test("voices load asynchronously without speaking old taps", () => {
  const s = setup();
  let loaded = false;
  s.speech.getVoices = () =>
    loaded
      ? [{ name: "British offline", lang: "en-GB", localService: true }]
      : [];
  s.player.setFiles([]);
  s.player.speak(1, defaults);
  s.player.speak(2, defaults);
  loaded = true;
  s.player.voicesChanged();
  assert.deepEqual(
    s.utterances.map((u) => u.text),
    ["Two"],
  );
  s.player.dispose();
});
test("playback status comes from real media events and ignores old callbacks", () => {
  const s = setup();
  s.player.speak(1, defaults);
  const previousEnd = s.audio.onended;
  s.audio.onplaying();
  assert.match(s.statuses.at(-1), /001.mp3 · đang phát/);
  s.player.speak(2, defaults);
  previousEnd();
  assert.doesNotMatch(s.statuses.at(-1), /001.mp3 · đã phát xong/);
  s.audio.onended();
  assert.match(s.statuses.at(-1), /002.mp3 · đã phát xong/);
  s.player.dispose();
});
test("IndexedDB blob sources take priority over hosted MP3 and retain latest-tap behavior", () => {
  const s = setup();
  s.player.setLocalFiles(
    new Map([
      [1, "blob:private-one"],
      [2, "blob:private-two"],
    ]),
  );
  s.player.speak(1, defaults);
  s.player.speak(2, defaults);
  assert.deepEqual(s.plays, ["blob:private-one", "blob:private-two"]);
  assert.equal(s.utterances.length, 0);
  s.player.speak(3, defaults);
  assert.equal(s.plays.at(-1), "/audio/sonia/003.mp3");
  s.player.dispose();
});
