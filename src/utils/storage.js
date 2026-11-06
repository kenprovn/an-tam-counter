import { defaults, themes } from "../config.js";
export const STORAGE_KEY = "an-tam-counter-v1";
export function validCount(value) {
  if (typeof value === "string" && !/^\d+$/.test(value.trim())) return null;
  if (!["string", "number"].includes(typeof value)) return null;
  const number = Number(value);
  return Number.isSafeInteger(number) && number >= 0 ? number : null;
}
export function sanitizeSettings(input = {}) {
  const settings = { ...defaults };
  for (const key of Object.keys(defaults)) {
    if (typeof defaults[key] === "boolean" && typeof input[key] === "boolean")
      settings[key] = input[key];
  }
  if (Number.isFinite(input.volume))
    settings.volume = Math.min(1, Math.max(0, input.volume));
  if ([0.75, 1, 1.25, 1.5].includes(input.rate)) settings.rate = input.rate;
  if (["mp3", "tts"].includes(input.mode)) settings.mode = input.mode;
  if (Object.hasOwn(themes, input.theme)) settings.theme = input.theme;
  if ([0, 100, 250, 500].includes(input.debounce))
    settings.debounce = input.debounce;
  if ([0.9, 1, 1.15, 1.3].includes(input.fontSize))
    settings.fontSize = input.fontSize;
  if (validCount(input.goal) !== null && Number(input.goal) > 0)
    settings.goal = Number(input.goal);
  return settings;
}
export function parseData(raw) {
  const value = JSON.parse(raw);
  if (!value || validCount(value.count) === null)
    throw new Error("Số biến trong tệp không hợp lệ.");
  return {
    count: Number(value.count),
    settings: sanitizeSettings(value.settings),
  };
}
export function loadData(storage) {
  try {
    const raw = (storage ?? globalThis.localStorage).getItem(STORAGE_KEY);
    if (raw) return parseData(raw);
  } catch {
    /* Start safely if storage is unavailable. */
  }
  return { count: 0, settings: { ...defaults } };
}
export function saveData(data, storage) {
  try {
    (storage ?? globalThis.localStorage).setItem(
      STORAGE_KEY,
      JSON.stringify({ version: 1, ...data }),
    );
    return true;
  } catch {
    return false;
  }
}
