import {
  X,
  Play,
  Download,
  Upload,
  RotateCcw,
  Maximize,
  Volume2,
  Palette,
  Hand,
  Database,
  ChevronRight,
  ArrowDownToLine,
} from "lucide-react";
import { themes } from "../config.js";
export function Toggle({ label, checked, onChange, hint }) {
  return (
    <label className="setting-row">
      <span>
        {label}
        {hint && <small>{hint}</small>}
      </span>
      <input
        className="toggle"
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
    </label>
  );
}
function Group({ icon: Icon, title, children, open }) {
  return (
    <details open={open} className="settings-group">
      <summary>
        <Icon size={18} />
        <span>{title}</span>
        <ChevronRight size={16} />
      </summary>
      <div className="group-content">{children}</div>
    </details>
  );
}
export default function Settings({
  settings: s,
  count,
  online,
  offlineReady,
  install,
  change,
  close,
  player,
  manifest,
  offlineCount,
  downloading,
  download,
  status,
  notice,
  edit,
  undo,
  reset,
  exportData,
  importData,
}) {
  return (
    <div className="modal-backdrop" onClick={close}>
      <section
        className="settings-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="panel-heading">
          <div>
            <span className="eyebrow">AN TÂM</span>
            <h2 id="settings-title">Cài đặt</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Đóng cài đặt"
            onClick={close}
          >
            <X />
          </button>
        </header>
        <div className="settings-scroll">
          <Group icon={Volume2} title="Âm thanh" open>
            <div className="voice-card">
              <span className="voice-avatar">S</span>
              <div>
                <strong>British English – Sonia</strong>
                <small>Microsoft · en-GB-SoniaNeural</small>
              </div>
              <span className="badge">MẶC ĐỊNH</span>
            </div>
            <Toggle
              label="Bật giọng đọc"
              checked={s.enabled}
              onChange={(enabled) => change({ enabled })}
            />
            <label className="setting-row">
              Chế độ phát
              <select
                value={s.mode}
                onChange={(event) => change({ mode: event.target.value })}
              >
                <option value="mp3">File MP3 Sonia</option>
                <option value="tts">Web Speech dự phòng</option>
              </select>
            </label>
            <Toggle
              label="Tự dùng giọng dự phòng"
              hint="Khi thiếu MP3 hoặc số vượt 100. Giọng phụ thuộc thiết bị, có thể cần mạng."
              checked={s.fallback}
              onChange={(fallback) => change({ fallback })}
            />
            <label className="setting-row">
              Âm lượng{" "}
              <span className="range-control">
                <input
                  aria-label="Âm lượng"
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={s.volume}
                  onChange={(event) =>
                    change({ volume: Number(event.target.value) })
                  }
                />
                <output>{Math.round(s.volume * 100)}%</output>
              </span>
            </label>
            <div className="setting-row">
              <span>Tốc độ phát</span>
              <div className="segmented">
                {[0.75, 1, 1.25, 1.5].map((rate) => (
                  <button
                    key={rate}
                    aria-pressed={s.rate === rate}
                    onClick={() => change({ rate })}
                  >
                    {rate}x
                  </button>
                ))}
              </div>
            </div>
            <Toggle
              label="Đọc số khi giảm"
              checked={s.speakOnDecrease}
              onChange={(speakOnDecrease) => change({ speakOnDecrease })}
            />
            <button
              className="secondary-button full"
              onClick={() => player.current?.speak(27, { ...s, enabled: true })}
            >
              <Play size={16} />
              Nghe thử · Twenty-seven
            </button>
            <p className="status-text" role="status">
              {status ||
                "MP3 Sonia được ưu tiên. Android không cần cài giọng Sonia."}
            </p>
            <div className="offline-card">
              <div className="setting-row">
                <strong>Thư viện Sonia</strong>
                <span className="badge">{manifest.files.length}/100 MP3</span>
              </div>
              <p>
                {manifest.checking
                  ? `Đang kiểm tra khả năng giải mã ${manifest.checked}/${manifest.candidates} MP3 trên thiết bị…`
                  : manifest.files.length === 100
                    ? `Đã lưu offline ${offlineCount}/100 file trên thiết bị này.`
                    : `Có ${manifest.files.length}/100 MP3 hợp lệ trên thiết bị. File thiếu hoặc lỗi sẽ dùng giọng dự phòng nếu được bật.`}
              </p>
              <button
                className="secondary-button full"
                disabled={
                  downloading ||
                  manifest.checking ||
                  manifest.files.length !== 100
                }
                onClick={download}
              >
                <Download size={16} />
                {downloading
                  ? `Đang lưu ${offlineCount}/100…`
                  : "Tải 100 file để nghe offline"}
              </button>
              <small>
                Trình duyệt có thể xóa bộ nhớ đệm khi thiếu dung lượng. TTS dự
                phòng không được đảm bảo offline.
              </small>
            </div>
          </Group>
          <Group icon={Palette} title="Giao diện & màu sắc">
            <div className="theme-grid">
              {Object.entries(themes).map(([key, theme]) => (
                <button
                  key={key}
                  aria-pressed={s.theme === key}
                  onClick={() => change({ theme: key })}
                >
                  <span style={{ background: theme.accent }} />
                  {theme.name}
                </button>
              ))}
            </div>
            <Toggle
              label="Hiệu ứng phát sáng"
              checked={s.glow}
              onChange={(glow) => change({ glow })}
            />
            <Toggle
              label="Hiệu ứng chuyển động"
              checked={s.animation}
              onChange={(animation) => change({ animation })}
            />
            <label className="setting-row">
              Kích thước chữ
              <select
                value={s.fontSize}
                onChange={(event) =>
                  change({ fontSize: Number(event.target.value) })
                }
              >
                {[0.9, 1, 1.15, 1.3].map((size) => (
                  <option key={size} value={size}>
                    {Math.round(size * 100)}%
                  </option>
                ))}
              </select>
            </label>
            <Toggle
              label="Tiết kiệm pin tối đa"
              hint="Tắt rung, chuyển động, phát sáng và giữ màn hình sáng."
              checked={s.battery}
              onChange={(battery) => change({ battery })}
            />
            <button
              className="secondary-button full"
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else await document.documentElement.requestFullscreen();
                } catch {
                  notice("Trình duyệt không cho phép toàn màn hình.");
                }
              }}
            >
              <Maximize size={16} />
              Bật / tắt toàn màn hình
            </button>
          </Group>
          <Group icon={Hand} title="Thao tác">
            <Toggle
              label="Rung nhẹ khi chạm"
              checked={s.vibration}
              onChange={(vibration) => change({ vibration })}
            />
            <label className="setting-row">
              Chống chạm nhầm
              <select
                value={s.debounce}
                onChange={(event) =>
                  change({ debounce: Number(event.target.value) })
                }
              >
                <option value="0">Tắt · nhận mọi lần chạm</option>
                <option value="100">100 ms</option>
                <option value="250">250 ms</option>
                <option value="500">500 ms</option>
              </select>
            </label>
            <Toggle
              label="Giữ màn hình sáng"
              hint="Chỉ hoạt động khi ứng dụng đang mở, màn hình chưa khóa."
              checked={s.wakeLock}
              onChange={(wakeLock) => change({ wakeLock })}
            />
            <button className="secondary-button full" onClick={undo}>
              <RotateCcw size={16} />
              Hoàn tác lần đếm gần nhất
            </button>
          </Group>
          <Group icon={Database} title="Số biến & dữ liệu">
            <div className="data-summary">
              <span>
                Số biến hiện tại<strong>{count.toLocaleString("vi-VN")}</strong>
              </span>
              <span>
                Mục tiêu<strong>{s.goal.toLocaleString("vi-VN")}</strong>
              </span>
            </div>
            <label className="setting-row">
              Mục tiêu
              <input
                aria-label="Mục tiêu"
                type="number"
                min="1"
                step="1"
                value={s.goal}
                onChange={(event) => {
                  const goal = Number(event.target.value);
                  if (Number.isSafeInteger(goal) && goal > 0) change({ goal });
                }}
              />
            </label>
            <p className="muted">
              Luôn tiếp tục đếm khi đạt mục tiêu. Không tự đặt lại ở 100.
            </p>
            <button className="secondary-button full" onClick={edit}>
              Nhập số biến hiện tại
            </button>
            <div className="button-pair">
              <button className="secondary-button" onClick={exportData}>
                <Download size={16} />
                Xuất dữ liệu
              </button>
              <label className="secondary-button file-button">
                <Upload size={16} />
                Nhập dữ liệu
                <input
                  type="file"
                  accept="application/json,.json"
                  onChange={importData}
                />
              </label>
            </div>
            <button className="danger-button full" onClick={reset}>
              Đặt lại số biến về 0
            </button>
          </Group>
          <button className="secondary-button full" onClick={install}>
            <ArrowDownToLine size={17} />
            Cài ứng dụng
          </button>
          <p className="device-status">
            {!online
              ? "Đang ngoại tuyến"
              : offlineReady
                ? "Ứng dụng đã sẵn sàng đếm offline"
                : "Số biến được tự động lưu trên thiết bị"}
          </p>
          <p className="settings-footer">
            An Tâm · Không tài khoản · Không quảng cáo
            <br />
            Số biến và cài đặt được lưu trên thiết bị của bạn.
          </p>
        </div>
      </section>
    </div>
  );
}
