import { validCount } from "./storage.js";
// Independent, synchronous count: no stale React state, including rapid taps.
export function createCounter(initial = 0, onChange = () => {}) {
  let count = validCount(initial) ?? 0;
  const history = [];
  return {
    get value() {
      return count;
    },
    set(value) {
      const next = validCount(value);
      if (next === null || next === count) return false;
      history.push(count);
      if (history.length > 100) history.shift();
      count = next;
      onChange(count);
      return true;
    },
    add(delta) {
      return this.set(Math.max(0, count + delta));
    },
    undo() {
      if (!history.length) return false;
      count = history.pop();
      onChange(count);
      return true;
    },
  };
}
