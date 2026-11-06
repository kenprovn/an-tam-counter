import { audioPath, numberText } from "./numbers.js";
export class NumberPlayer {
  constructor({
    audio = new Audio(),
    speech = globalThis.speechSynthesis,
    Utterance = globalThis.SpeechSynthesisUtterance,
    onStatus = () => {},
  } = {}) {
    this.audio = audio;
    this.speech = speech;
    this.Utterance = Utterance;
    this.onStatus = onStatus;
    this.sequence = 0;
    this.available = new Set();
    this.voicesChanged = () => {
      if (this.pending) {
        const pending = this.pending;
        this.pending = null;
        pending();
      }
    };
    speech?.addEventListener("voiceschanged", this.voicesChanged);
  }
  setFiles(files) {
    this.available = new Set(files);
  }
  stop() {
    this.sequence++;
    this.pending = null;
    clearTimeout(this.voiceTimer);
    this.audio.onerror = null;
    this.audio.onplaying = null;
    this.audio.onended = null;
    this.audio.pause();
    this.audio.removeAttribute("src");
    this.audio.load();
    this.speech?.cancel();
  }
  speak(number, settings) {
    this.stop();
    if (!settings.enabled) return;
    const sequence = this.sequence;
    let fallbackStarted = false;
    const fallback = () => {
      if (sequence !== this.sequence || fallbackStarted) return;
      fallbackStarted = true;
      this.audio.onerror = null;
      this.audio.onplaying = null;
      this.audio.onended = null;
      this.audio.pause();
      this.tts(number, settings, sequence);
    };
    if (settings.mode === "tts") {
      fallback();
      return;
    }
    if (!this.available.has(number)) {
      if (settings.fallback) fallback();
      else
        this.onStatus("Chưa có file Sonia cho số này. Số biến vẫn được lưu.");
      return;
    }
    this.audio.volume = settings.volume;
    this.audio.playbackRate = settings.rate;
    this.audio.preservesPitch = true;
    this.audio.src = audioPath(number);
    const filename = audioPath(number).split("/").at(-1);
    this.audio.onplaying = () => {
      if (sequence === this.sequence)
        this.onStatus(`Sonia · MP3 · ${filename} · đang phát`);
    };
    this.audio.onended = () => {
      if (sequence === this.sequence)
        this.onStatus(`Sonia · MP3 · ${filename} · đã phát xong`);
    };
    this.audio.onerror = () => {
      if (sequence !== this.sequence) return;
      this.audio.onerror = null;
      if (settings.fallback) fallback();
      else
        this.onStatus(
          "Không tải được MP3 Sonia. Hãy tải âm thanh ngoại tuyến.",
        );
    };
    this.onStatus("Sonia · MP3");
    try {
      const playing = this.audio.play(); // Called directly within the user's click gesture.
      playing?.catch((error) => {
        if (sequence !== this.sequence || error.name === "AbortError") return;
        this.audio.onerror = null;
        if (error.name === "NotAllowedError")
          this.onStatus(
            "Trình duyệt chặn âm thanh. Hãy chạm “Nghe thử” để bật lại.",
          );
        else if (settings.fallback) fallback();
        else this.onStatus("Không phát được MP3 Sonia trên thiết bị này.");
      });
    } catch {
      if (settings.fallback) fallback();
    }
  }
  tts(number, settings, sequence) {
    if (!this.speech || !this.Utterance) {
      this.onStatus(
        "Thiết bị không hỗ trợ giọng dự phòng. Số biến vẫn được lưu.",
      );
      return;
    }
    const run = (allowWait) => {
      if (sequence !== this.sequence) return;
      const voices = this.speech
        .getVoices()
        .filter((v) => /^en(?:-|_)/i.test(v.lang));
      if (!voices.length && allowWait) {
        this.onStatus("Đang tải giọng tiếng Anh của thiết bị…");
        this.pending = () => run(false);
        this.voiceTimer = setTimeout(() => {
          this.pending = null;
          run(false);
        }, 1500);
        return;
      }
      clearTimeout(this.voiceTimer);
      if (!voices.length) {
        this.onStatus(
          "Chưa có giọng tiếng Anh dự phòng. Kiểm tra cài đặt TTS của thiết bị.",
        );
        return;
      }
      const voice =
        voices.find((v) => /Sonia/i.test(v.name) && /^en-GB$/i.test(v.lang)) ??
        voices.find((v) => /^en-GB$/i.test(v.lang) && v.localService) ??
        voices.find((v) => /^en-GB$/i.test(v.lang)) ??
        voices[0];
      const utterance = new this.Utterance(numberText(number));
      utterance.voice = voice;
      utterance.lang = voice.lang;
      utterance.rate = settings.rate;
      utterance.volume = settings.volume;
      utterance.onerror = (event) => {
        if (
          sequence === this.sequence &&
          !["canceled", "interrupted"].includes(event.error)
        )
          this.onStatus(
            "Giọng dự phòng không phát được; có thể cần mạng hoặc cài giọng offline.",
          );
      };
      this.onStatus(
        `Giọng dự phòng: ${voice.name}${voice.localService ? " · trên thiết bị" : " · có thể cần mạng"}`,
      );
      this.speech.speak(utterance);
    };
    run(true);
  }
  dispose() {
    this.stop();
    this.speech?.removeEventListener("voiceschanged", this.voicesChanged);
  }
}
