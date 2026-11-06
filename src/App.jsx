import { useCallback, useEffect, useRef, useState } from "react";
import {
  Volume2,
  VolumeX,
  Minus,
  Plus,
  SlidersHorizontal,
  RotateCcw,
  ArrowDownToLine,
  CircleCheck,
  Hand,
  X,
} from "lucide-react";
import { themes } from "./config.js";
import { loadData, saveData, validCount, parseData } from "./utils/storage.js";
import { createCounter } from "./utils/counter.js";
import { NumberPlayer } from "./audio/player.js";
import { cachedCount, downloadAudio } from "./audio/cache.js";
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
    fetch("/audio/sonia/manifest.json")
      .then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      })
      .then(async (data) => {
        if (disposed) return;
        if (
          data.voice !== "en-GB-SoniaNeural" ||
          !Array.isArray(data.files) ||
          !data.files.every((n) => Number.isInteger(n) && n >= 1 && n <= 100) ||
          new Set(data.files).size !== data.files.length
        )
          throw new Error();
        audio.setFiles(data.files);
        setManifest(data);
        const cached = await cachedCount(data);
        if (!disposed) setOfflineCount(cached);
      })
      .catch(() => {
        if (!disposed)
          setAudioStatus(
            "Chưa tải được danh sách MP3 Sonia. Đang dùng cấu hình dự phòng.",
          );
      });
    return () => {
      disposed = true;
      audio.dispose();
      abort.current?.abort();
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
  const theme = themes[settings.theme];
  const progress = Math.min(100, (count / settings.goal) * 100);
  return (
    <div
      className={`app ${settings.glow && !settings.battery ? "has-glow" : ""} ${!settings.animation || settings.battery ? "no-animation" : ""}`}
      style={{
        "--accent": theme.accent,
        "--bg": theme.bg,
        "--font-scale": settings.fontSize,
      }}
    >
      <main className="main-shell" inert={settingsOpen ? true : undefined}>
        <header className="brand-header">
          <a
            className="brand"
            href="/"
            onClick={(event) => event.preventDefault()}
          >
            <span className="brand-mark">
              <CircleCheck size={21} />
            </span>
            <span>
              An Tâm<span className="brand-dot">.</span>
            </span>
          </a>
          <span className="session-label">
            <i />
            KHÔNG GIAN TĨNH TÂM
          </span>
        </header>
        <div className="intro">
          <span className="eyebrow">MỖI LẦN CHẠM, MỘT LẦN AN TÂM</span>
          <h1>Đếm biến Chú Đại Bi</h1>
          <p>Thả lỏng tâm trí. Nhẹ nhàng tiếp tục.</p>
        </div>
        <div className="counter-toolbar" aria-label="Điều khiển số biến">
          <button
            className={`icon-button sound-button ${settings.enabled ? "active" : ""}`}
            aria-label={settings.enabled ? "Tắt giọng đọc" : "Bật giọng đọc"}
            aria-pressed={settings.enabled}
            onClick={() => change({ enabled: !settings.enabled })}
          >
            {settings.enabled ? <Volume2 size={21} /> : <VolumeX size={21} />}
          </button>
          <button
            className="count-readout"
            onClick={edit}
            aria-label={`Số biến hiện tại ${count}. Nhập số biến`}
          >
            <span>{count.toLocaleString("vi-VN")}</span>
            <small>BIẾN ĐÃ TRÌ TỤNG</small>
          </button>
          <div className="step-controls">
            <button
              className="icon-button"
              aria-label="Giảm một biến"
              disabled={count === 0}
              onClick={decrease}
            >
              <Minus size={20} />
            </button>
            <button
              className="icon-button"
              aria-label="Tăng một biến"
              onClick={() => increment()}
            >
              <Plus size={20} />
            </button>
          </div>
          <span className="toolbar-divider" />
          <button
            ref={settingsButton}
            className="icon-button"
            aria-label="Mở cài đặt"
            onClick={() => setSettingsOpen(true)}
          >
            <SlidersHorizontal size={20} />
          </button>
        </div>
        <button
          className="count-pad"
          aria-label="Chạm để đếm thêm một biến"
          onClick={() => increment(true)}
        >
          <span className="pad-corner top-left" />
          <span className="pad-corner top-right" />
          <span className="pad-corner bottom-left" />
          <span className="pad-corner bottom-right" />
          <span key={pulse} className="tap-symbol">
            <Hand size={40} strokeWidth={1.3} />
            <span className="tap-plus">+</span>
          </span>
          <span className="pad-title">
            CHẠM ĐỂ ĐẾM <b>+1</b>
          </span>
          <span className="pad-subtitle">Một biến chú. Một tâm an.</span>
          <span className="pad-bottom">
            <span className="tiny-dot" /> CHẠM BẤT KỲ ĐÂU TRONG VÙNG NÀY
          </span>
        </button>
        <div className="goal-section">
          <div>
            <span>Hành trình hôm nay</span>
            <strong>
              {count >= settings.goal && <CircleCheck size={14} />}
              {count.toLocaleString("vi-VN")}{" "}
              <em>/ {settings.goal.toLocaleString("vi-VN")} biến</em>
            </strong>
          </div>
          <div
            className="progress-track"
            role="progressbar"
            aria-label="Tiến độ mục tiêu"
            aria-valuenow={Math.min(count, settings.goal)}
            aria-valuemin={0}
            aria-valuemax={settings.goal}
          >
            <span style={{ width: `${progress}%` }} />
          </div>
          <p>
            {count >= settings.goal
              ? "Đã đạt mục tiêu. Bạn vẫn có thể tiếp tục đếm."
              : "Không vội vàng. Mỗi biến đều có ý nghĩa."}
          </p>
        </div>
        <footer className="app-footer">
          <button onClick={undo}>
            <RotateCcw size={14} />
            Hoàn tác
          </button>
          <span className="save-indicator">
            <i />
            Tự động lưu
          </span>
          {installPrompt ? (
            <button
              onClick={async () => {
                await installPrompt.prompt();
                setInstallPrompt(null);
              }}
            >
              <ArrowDownToLine size={14} />
              Cài ứng dụng
            </button>
          ) : (
            <button
              onClick={() =>
                setNotice(
                  offlineReady
                    ? "Ứng dụng đã sẵn sàng offline. Cài lên màn hình chính từ menu Chrome ⋮ → Cài đặt ứng dụng / Thêm vào màn hình chính."
                    : "Mở bằng Chrome qua HTTPS; chọn menu ⋮ → Thêm vào màn hình chính. Offline hoạt động sau khi tải ứng dụng lần đầu.",
                )
              }
            >
              <ArrowDownToLine size={14} />
              Cài ứng dụng
            </button>
          )}
        </footer>
        <p className="connection-note">
          {!online
            ? "Đang ngoại tuyến"
            : offlineReady
              ? "Sẵn sàng đếm ngoại tuyến"
              : "Đếm an tâm, theo nhịp của bạn"}
          <span>·</span>
          {manifest.files.length === 100
            ? `Sonia MP3${offlineCount === 100 ? " · đã lưu offline" : ""}`
            : "Chưa có bộ MP3 Sonia"}
        </p>
      </main>
      {settingsOpen && (
        <Settings
          settings={settings}
          change={change}
          close={() => setSettingsOpen(false)}
          player={player}
          manifest={manifest}
          offlineCount={offlineCount}
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
