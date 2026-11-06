import { Volume2, VolumeX, Minus, Plus, Settings } from "lucide-react";

function LotusMark() {
  return (
    <svg
      className="lotus-mark"
      viewBox="0 0 64 52"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      aria-hidden="true"
    >
      <path d="M32 47C17 40 20 21 32 5c12 16 15 35 0 42Z" />
      <path d="M24 26C18 19 10 17 10 17c-1 16 6 28 22 30M40 26c6-7 14-9 14-9 1 16-6 28-22 30" />
      <path d="M13 32 2 34c8 15 20 19 30 13M51 32l11 2c-8 15-20 19-30 13" />
    </svg>
  );
}
function TapMark() {
  return (
    <svg
      className="tap-mark"
      viewBox="0 0 96 116"
      fill="none"
      stroke="currentColor"
      strokeWidth="4.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M19 52a32 32 0 1 1 58-1M30 47a20 20 0 1 1 36-1" />
      <path d="M41 76V38a5.5 5.5 0 0 1 11 0v30-8a5.5 5.5 0 0 1 11 0v10-5a5.5 5.5 0 0 1 11 0v10-4a5.5 5.5 0 0 1 11 0v16c0 15-10 24-24 24H55c-8 0-14-4-19-11L23 82c-5-7 3-14 9-9l9 9" />
    </svg>
  );
}
export default function MainCounter({
  count,
  settings,
  settingsButton,
  settingsOpen,
  openSettings,
  edit,
  increment,
  decrease,
  change,
  pulse,
}) {
  const digits = String(count).length;
  return (
    <main className="main-shell" inert={settingsOpen ? true : undefined}>
      <header className="main-header">
        <LotusMark />
        <h1>Đếm biến Chú Đại Bi</h1>
      </header>
      <div
        className={`counter-toolbar ${digits > 6 ? "long-count" : ""}`}
        aria-label="Điều khiển số biến"
      >
        <button
          className="sound-control control-pill"
          role="switch"
          aria-checked={settings.enabled}
          aria-label={settings.enabled ? "Tắt giọng đọc" : "Bật giọng đọc"}
          onClick={() => change({ enabled: !settings.enabled })}
        >
          {settings.enabled ? <Volume2 /> : <VolumeX />}
          <span className="control-label">Đọc số</span>
          <span
            className={`toggle-track ${settings.enabled ? "is-on" : ""}`}
            aria-hidden="true"
          >
            <span />
          </span>
        </button>
        <div className="count-control control-pill">
          <button
            className="step-button"
            aria-label="Giảm một biến"
            disabled={count === 0}
            onClick={decrease}
          >
            <Minus />
          </button>
          <button
            className={`count-readout ${digits > 4 ? "smaller-count" : ""} ${digits > 10 ? "smallest-count" : ""}`}
            onClick={edit}
            title={count.toLocaleString("vi-VN")}
            aria-label={`Số biến hiện tại ${count}. Nhập số biến`}
          >
            <span>{count.toLocaleString("vi-VN")}</span>
          </button>
          <button
            className="step-button"
            aria-label="Tăng một biến"
            onClick={() => increment()}
          >
            <Plus />
          </button>
        </div>
        <button
          ref={settingsButton}
          className="settings-control control-pill"
          aria-label="Mở cài đặt"
          onClick={openSettings}
        >
          <Settings />
          <span className="control-label">Cài đặt</span>
        </button>
      </div>
      <button
        className="count-pad"
        aria-label="Chạm để đếm thêm một biến"
        onClick={() => increment(true)}
      >
        <span className="pad-content">
          <span key={pulse} className="tap-symbol">
            <TapMark />
          </span>
          <span className="pad-title">
            Chạm để đếm <b>+1</b>
          </span>
          <span className="pad-subtitle">
            Mỗi lần chạm sẽ đọc số biến hiện tại
          </span>
        </span>
      </button>
    </main>
  );
}
