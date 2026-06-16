import { useEffect, useState } from "react";

/**
 * Like useState, but the value is mirrored to localStorage under `key`, so it survives reloads.
 * Falls back to `initial` when nothing is stored or storage is unavailable (e.g. private mode).
 */
export function usePersistentState<T>(key: string, initial: T): [T, (v: T) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      return raw != null ? (JSON.parse(raw) as T) : initial;
    } catch {
      return initial;
    }
  });
  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore quota / unavailable storage */
    }
  }, [key, value]);
  return [value, setValue];
}
