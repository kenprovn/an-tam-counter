import { useEffect } from "react";
export function useWakeLock(enabled, onError) {
  useEffect(() => {
    if (!enabled) return;
    let lock,
      disposed = false;
    const request = async () => {
      if (document.visibilityState !== "visible" || (lock && !lock.released))
        return;
      if (!navigator.wakeLock) {
        onError("Thiết bị chưa hỗ trợ giữ màn hình sáng.");
        return;
      }
      try {
        const acquired = await navigator.wakeLock.request("screen");
        if (disposed) await acquired.release();
        else lock = acquired;
      } catch {
        onError("Không giữ được màn hình sáng. Kiểm tra chế độ tiết kiệm pin.");
      }
    };
    request();
    document.addEventListener("visibilitychange", request);
    return () => {
      disposed = true;
      lock?.release();
      document.removeEventListener("visibilitychange", request);
    };
  }, [enabled, onError]);
}
