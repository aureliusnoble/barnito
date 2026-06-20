import { useEffect, useState } from "react";

/**
 * Like useState, but the value is mirrored to localStorage under `key`, so it survives reloads.
 * Falls back to `initial` when nothing is stored or storage is unavailable (e.g. private mode).
 *
 * If `key` changes during the component's life (e.g. the daily puzzle rolls over to a new date at
 * midnight), the state re-reads from the new key — so we don't keep, or worse persist, the old key's
 * value under the new key.
 */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const read = (k: string): T => {
    try {
      const raw = localStorage.getItem(k);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  };
  const [entry, setEntry] = useState<{ key: string; value: T }>(() => ({ key, value: read(key) }));
  // Key changed since last render → adopt the new key's stored value (React-blessed "adjust state on
  // prop change" pattern: conditional setState during render, converges next render).
  if (entry.key !== key) setEntry({ key, value: read(key) });
  const value = entry.key === key ? entry.value : read(key);
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [key, value]);
  return [value, (v: T) => setEntry({ key, value: v })];
}
