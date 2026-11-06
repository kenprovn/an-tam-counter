export const AUDIO_DB = "an-tam-private-audio-v1";
function open(factory) {
  if (!factory)
    return Promise.reject(
      new Error("Thiết bị không hỗ trợ IndexedDB để lưu bộ ZIP."),
    );
  return new Promise((resolve, reject) => {
    let blocked = false;
    const request = factory.open(AUDIO_DB, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore("packs", { keyPath: "id" });
      request.result.createObjectStore("meta", { keyPath: "key" });
    };
    request.onerror = () => reject(request.error);
    request.onblocked = () => {
      blocked = true;
      reject(new Error("Đóng tab An Tâm khác rồi thử nhập ZIP lại."));
    };
    request.onsuccess = () => {
      if (blocked) {
        request.result.close();
        return;
      }
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}
export async function saveDevicePack(pack, factory = globalThis.indexedDB) {
  const db = await open(factory);
  try {
    await new Promise((resolve, reject) => {
      const tx = db.transaction(["packs", "meta"], "readwrite");
      tx.oncomplete = resolve;
      tx.onabort = tx.onerror = () =>
        reject(
          tx.error ?? new Error("Không lưu được bộ ZIP. Bộ cũ vẫn được giữ."),
        );
      // Both operations commit together. Existing packs and count/settings stay intact.
      try {
        tx.objectStore("packs").put(pack);
        tx.objectStore("meta").put({ key: "active", id: pack.id });
      } catch (error) {
        tx.abort();
        reject(error);
      }
    });
  } finally {
    db.close();
  }
}
export async function loadDevicePack(factory = globalThis.indexedDB) {
  const db = await open(factory);
  try {
    return await new Promise((resolve, reject) => {
      const tx = db.transaction(["packs", "meta"], "readonly");
      let pack = null;
      tx.oncomplete = () => resolve(pack);
      tx.onabort = tx.onerror = () => reject(tx.error);
      const active = tx.objectStore("meta").get("active");
      active.onsuccess = () => {
        if (!active.result) return;
        const request = tx.objectStore("packs").get(active.result.id);
        request.onsuccess = () => {
          pack = request.result ?? null;
        };
      };
    });
  } finally {
    db.close();
  }
}
