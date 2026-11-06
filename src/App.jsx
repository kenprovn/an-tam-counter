import { useCallback, useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import MainCounter from "./components/MainCounter.jsx";
import { themes } from "./config.js";
import { loadData, saveData, validCount, parseData } from "./utils/storage.js";
import { createCounter } from "./utils/counter.js";
import { NumberPlayer } from "./audio/player.js";
import { downloadAudio } from "./audio/cache.js";
import { verifyLibrary, validateManifest } from "./audio/library.js";
import { loadDevicePack, saveDevicePack } from "./audio/device-store.js";
import {
  importZipPack,
  verifyDevicePack,
  deviceSources,
} from "./audio/zip-pack.js";
import { useWakeLock } from "./hooks/useWakeLock.js";
import Settings from "./components/Settings.jsx";
import Dialog from "./components/Dialog.jsx";

export default function App() {
  const [initial] = useState(loadData);
  const [count, setCount] = useState(initial.count);
  const [settings, setSettings] = useState(initial.settings);
  const settingsRef = useRef(settings);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [dialog, setDialog] = useState(null);
  const [input, setInput] = useState("");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [audioStatus, setAudioStatus] = useState("");
  const [manifest, setManifest] = useState({ files: [], revision: "empty" });
  const [offlineCount, setOfflineCount] = useState(0);
  const [downloading, setDownloading] = useState(false);
  const [deviceManifest, setDeviceManifest] = useState(null);
  const [importingZip, setImportingZip] = useState(false);
  const [zipProgress, setZipProgress] = useState(0);
  const privateSources = useRef(new Map()),
    deviceEpoch = useRef(0),
    zipAbort = useRef(null);
  const [online, setOnline] = useState(navigator.onLine);
  const [offlineReady, setOfflineReady] = useState(false);
  const [installPrompt, setInstallPrompt] = useState(null);
  const [pulse, setPulse] = useState(0);
  const player = useRef(null),
    abort = useRef(null),
    lastTap = useRef(-Infinity),
    settingsButton = useRef(null),
    panel = useRef(null);
  const counter = useRef(null);
  if (!counter.current)
    counter.current = createCounter(initial.count, (next) => {
      setCount(next);
      if (!saveData({ count: next, settings: settingsRef.current }))
        setNotice(
          "Không lưu được dữ liệu. Kiểm tra dung lượng hoặc quyền lưu trữ của trình duyệt.",
        );
    });
  const notify = useCallback((message) => setNotice(message), []);
  useWakeLock(settings.wakeLock && !settings.battery, notify);

  useEffect(() => {
    const audio = new NumberPlayer({ onStatus: setAudioStatus });
    player.current = audio;
    let disposed = false;
    const controller = new AbortController();
    const epoch = deviceEpoch.current;
    loadDevicePack()
      .then(async (pack) => {
        if (!pack || disposed || epoch !== deviceEpoch.current) return;
        setDeviceManifest({
          ...pack.manifest,
          files: [],
          checking: true,
          checked: 0,
          candidates: 100,
        });
        const verified = await verifyDevicePack(pack, {
          signal: controller.signal,
          onProgress: (value) => {
            if (!disposed && epoch === deviceEpoch.current)
              setDeviceManifest({
                ...value,
                source: "zip-device",
                checking: value.checked < 100,
                candidates: 100,
              });
          },
        });
        if (disposed || epoch !== deviceEpoch.current) return;
        const sources = deviceSources(pack, verified.files);
        for (const url of privateSources.current.values())
          URL.revokeObjectURL(url);
        privateSources.current = sources;
        audio.setLocalFiles(sources);
        setDeviceManifest({
          ...verified,
          source: "zip-device",
          checking: false,
        });
      })
      .catch((error) => {
        if (!disposed && epoch === deviceEpoch.current) {
          setDeviceManifest(null);
          setNotice(`Chưa tải được bộ ZIP riêng. ${error.message}`);
        }
      });
    fetch("/audio/sonia/manifest.json", {
      signal: controller.signal,
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(async (data) => {
        if (disposed) return;
        validateManifest(data);
        // Build validation already confirmed these files. Try MP3 immediately;
        // device verification removes failures without delaying the user's tap.
        audio.setFiles(data.files);
        setManifest({
          ...data,
          files: [],
          checking: true,
          checked: 0,
          candidates: data.files.length,
        });
        const update = (result) => {
          if (disposed) return;
          const failed = new Set(result.unavailable.map((item) => item.number));
          audio.setFiles(data.files.filter((number) => !failed.has(number)));
          setManifest({
            ...result,
            checking: result.checked < data.files.length,
            candidates: data.files.length,
          });
          setOfflineCount(result.cached);
        };
        const result = await verifyLibrary(data, {
          signal: controller.signal,
          onProgress: update,
        });
        update(result);
      })
      .catch((error) => {
        if (!disposed) {
          setManifest((value) => ({ ...value, checking: false }));
          setAudioStatus(
            `Chưa kiểm tra được thư viện MP3. ${error.message} Giọng dự phòng vẫn khả dụng.`,
          );
        }
      });
    return () => {
      disposed = true;
      controller.abort();
      audio.dispose();
      abort.current?.abort();
      zipAbort.current?.abort();
      for (const url of privateSources.current.values())
        URL.revokeObjectURL(url);
      privateSources.current = new Map();
    };
  }, []);
  useEffect(() => {
    const connected = () => setOnline(navigator.onLine);
    const install = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    const installed = () => setInstallPrompt(null);
    window.addEventListener("online", connected);
    window.addEventListener("offline", connected);
    window.addEventListener("beforeinstallprompt", install);
    window.addEventListener("appinstalled", installed);
    let active = true;
    if ("serviceWorker" in navigator && import.meta.env.PROD)
      navigator.serviceWorker
        .register("/sw.js")
        .then(async () => {
          await navigator.serviceWorker.ready;
          if (active) setOfflineReady(true);
        })
        .catch(() => {
          if (active)
            setNotice(
              "Chưa lưu được ứng dụng offline. Hãy mở lại khi có mạng.",
            );
        });
    return () => {
      active = false;
      window.removeEventListener("online", connected);
      window.removeEventListener("offline", connected);
      window.removeEventListener("beforeinstallprompt", install);
      window.removeEventListener("appinstalled", installed);
    };
  }, []);
  useEffect(() => {
    if (!notice) return;
    const timeout = setTimeout(() => setNotice(""), 6000);
    return () => clearTimeout(timeout);
  }, [notice]);
  useEffect(() => {
    if (!settingsOpen) return;
    const element = document.querySelector(".settings-panel");
    panel.current = element;
    element.querySelector("button")?.focus();
    const onKey = (event) => {
      if (event.key === "Escape" && !dialog) setSettingsOpen(false);
      if (event.key !== "Tab" || dialog) return;
      const items = [
        ...element.querySelectorAll(
          'button:not(:disabled), input, select, summary, [tabindex="0"]',
        ),
      ].filter((item) => item.getClientRects().length);
      const first = items[0],
        last = items.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      settingsButton.current?.focus();
    };
  }, [settingsOpen, dialog]);

  function change(update) {
    const next = { ...settingsRef.current, ...update };
    settingsRef.current = next;
    setSettings(next);
    player.current?.stop();
    if (!saveData({ count: counter.current.value, settings: next }))
      setNotice("Không lưu được cài đặt trên thiết bị.");
  }
  function increment(fromPad = false) {
    const s = settingsRef.current;
    const now = performance.now();
    if (fromPad && now - lastTap.current < s.debounce) return;
    if (fromPad) lastTap.current = now;
    if (!counter.current.add(1)) {
      setNotice("Đã đạt giới hạn số nguyên an toàn. Hãy xuất dữ liệu.");
      return;
    }
    player.current?.speak(counter.current.value, s);
    if (s.vibration && !s.battery) navigator.vibrate?.(15);
    if (s.animation && !s.battery) setPulse((value) => value + 1);
  }
  function decrease() {
    if (!counter.current.add(-1)) return;
    player.current?.stop();
    if (settingsRef.current.speakOnDecrease)
      player.current?.speak(counter.current.value, settingsRef.current);
  }
  function undo() {
    player.current?.stop();
    if (counter.current.undo()) setNotice("Đã hoàn tác lần thay đổi gần nhất.");
    else setNotice("Chưa có thao tác để hoàn tác.");
  }
  function edit() {
    setInput(String(counter.current.value));
    setError("");
    setDialog("edit");
  }
  function confirmEdit(event) {
    event.preventDefault();
    const number = validCount(input);
    if (number === null) {
      setError("Nhập số nguyên từ 0 đến 9.007.199.254.740.991.");
      return;
    }
    counter.current.set(number);
    player.current?.stop();
    setDialog(null);
  }
  function exportData() {
    const url = URL.createObjectURL(
      new Blob(
        [
          JSON.stringify(
            {
              version: 1,
              count: counter.current.value,
              settings: settingsRef.current,
            },
            null,
            2,
          ),
        ],
        { type: "application/json" },
      ),
    );
    const link = document.createElement("a");
    link.href = url;
    link.download = "an-tam-backup.json";
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importData(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    try {
      if (file.size > 100_000)
        throw new Error("Tệp quá lớn. Chọn tệp dự phòng An Tâm.");
      const data = parseData(await file.text());
      setDialog({ type: "import", data });
    } catch (cause) {
      setNotice(cause.message || "Tệp dữ liệu không hợp lệ.");
    }
  }
  async function download() {
    setDownloading(true);
    abort.current = new AbortController();
    try {
      await downloadAudio(manifest, setOfflineCount, abort.current.signal);
      setNotice("Đã lưu đủ 100 MP3 Sonia để nghe offline trên thiết bị này.");
    } catch (cause) {
      if (cause.name !== "AbortError") setNotice(cause.message);
    } finally {
      setDownloading(false);
    }
  }
  async function importAudioZip(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file || importingZip) return;
    deviceEpoch.current++;
    setImportingZip(true);
    setZipProgress(0);
    zipAbort.current = new AbortController();
    try {
      const pack = await importZipPack(file, {
        signal: zipAbort.current.signal,
        onProgress: setZipProgress,
      });
      await saveDevicePack(pack);
      zipAbort.current.signal.throwIfAborted();
      const sources = deviceSources(pack);
      player.current?.stop();
      player.current?.setLocalFiles(sources);
      for (const url of privateSources.current.values())
        URL.revokeObjectURL(url);
      privateSources.current = sources;
      setDeviceManifest({ ...pack.manifest, checking: false });
      change({ mode: "mp3" });
      setNotice(
        "Đã lưu 100/100 MP3 từ ZIP vào IndexedDB trên thiết bị. Không tải âm thanh lên máy chủ.",
      );
    } catch (error) {
      if (error.name !== "AbortError")
        setNotice(
          error.name === "QuotaExceededError"
            ? "Không đủ dung lượng lưu ZIP. Bộ đã lưu trước đó vẫn được giữ."
            : error.message,
        );
    } finally {
      setImportingZip(false);
    }
  }
  const theme = themes[settings.theme];
  return (
    <div
      className={`app ${settings.glow && !settings.battery ? "has-glow" : ""} ${!settings.animation || settings.battery ? "no-animation" : ""}`}
      style={{
        "--accent": theme.accent,
        "--bg": theme.bg,
        "--font-scale": settings.fontSize,
      }}
    >
      <MainCounter
        count={count}
        settings={settings}
        settingsButton={settingsButton}
        settingsOpen={settingsOpen}
        openSettings={() => setSettingsOpen(true)}
        edit={edit}
        increment={increment}
        decrease={decrease}
        change={change}
        pulse={pulse}
      />
      {settingsOpen && (
        <Settings
          settings={settings}
          count={count}
          online={online}
          offlineReady={offlineReady}
          install={async () => {
            if (installPrompt) {
              await installPrompt.prompt();
              setInstallPrompt(null);
            } else {
              setNotice(
                "Cài ứng dụng từ menu Chrome ⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính.",
              );
            }
          }}
          change={change}
          close={() => setSettingsOpen(false)}
          player={player}
          manifest={deviceManifest ?? manifest}
          offlineCount={
            deviceManifest ? deviceManifest.files.length : offlineCount
          }
          importAudioZip={importAudioZip}
          importingZip={importingZip}
          zipProgress={zipProgress}
          downloading={downloading}
          download={download}
          status={audioStatus}
          notice={notify}
          edit={edit}
          undo={undo}
          reset={() => setDialog("reset")}
          exportData={exportData}
          importData={importData}
        />
      )}
      {dialog === "edit" && (
        <Dialog title="Nhập số biến" close={() => setDialog(null)}>
          <form onSubmit={confirmEdit}>
            <p>Tiếp tục từ số biến bạn đang trì tụng.</p>
            <input
              autoFocus
              aria-label="Số biến mới"
              inputMode="numeric"
              value={input}
              onChange={(event) => setInput(event.target.value)}
            />
            <p className="error" role="alert">
              {error}
            </p>
            <div className="dialog-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setDialog(null)}
              >
                Hủy
              </button>
              <button className="primary-button" type="submit">
                Xác nhận
              </button>
            </div>
          </form>
        </Dialog>
      )}
      {dialog === "reset" && (
        <Dialog title="Đặt lại về 0?" close={() => setDialog(null)}>
          <p>
            Số biến hiện tại là {count}. Bạn có thể hoàn tác sau khi đặt lại.
          </p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setDialog(null)}
            >
              Giữ số biến
            </button>
            <button
              className="danger-button"
              onClick={() => {
                counter.current.set(0);
                player.current?.stop();
                setDialog(null);
              }}
            >
              Đặt lại
            </button>
          </div>
        </Dialog>
      )}
      {dialog?.type === "import" && (
        <Dialog title="Khôi phục dữ liệu?" close={() => setDialog(null)}>
          <p>
            Thay số biến hiện tại bằng {dialog.data.count} và khôi phục cài đặt
            từ tệp?
          </p>
          <div className="dialog-actions">
            <button
              className="secondary-button"
              onClick={() => setDialog(null)}
            >
              Hủy
            </button>
            <button
              className="primary-button"
              onClick={() => {
                change(dialog.data.settings);
                counter.current.set(dialog.data.count);
                setDialog(null);
                setNotice("Đã khôi phục dữ liệu.");
              }}
            >
              Khôi phục
            </button>
          </div>
        </Dialog>
      )}
      {notice && (
        <div className="toast" role="status">
          {notice}
          <button aria-label="Đóng thông báo" onClick={() => setNotice("")}>
            <X size={16} />
          </button>
        </div>
      )}
      {!settingsOpen && audioStatus && !audioStatus.includes("Sonia · MP3") && (
        <div className="sr-only" role="status">
          {audioStatus}
        </div>
      )}
    </div>
  );
}
