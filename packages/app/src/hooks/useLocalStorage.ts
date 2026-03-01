import { useState, useCallback } from "react";

export interface UseLocalStorageOptions<T> {
  /** 读取后的校验/转换（入参为 JSON.parse 结果），返回最终使用的值；抛错则回退为 initialValue */
  parse?: (raw: unknown) => T;
}

function getStored<T>(
  key: string,
  initialValue: T,
  parse?: (raw: unknown) => T
): T {
  if (typeof window === "undefined") return initialValue;
  try {
    const raw = window.localStorage.getItem(key);
    if (raw == null) return initialValue;
    const parsed: unknown = JSON.parse(raw);
    return parse ? parse(parsed) : (parsed as T);
  } catch {
    return initialValue;
  }
}

function setStored<T>(key: string, value: T): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota exceeded or disabled
  }
}

/**
 * 与 useState 用法一致，同时把值持久化到 localStorage。
 * 初次渲染从 localStorage 读取（解析失败或 parse 抛错则用 initialValue），后续通过 setValue 更新并写回。
 *
 * @param key 存储键名
 * @param initialValue 初始值或返回初始值的函数（在 key 无缓存或解析失败时使用）
 * @param options.parse 读取后对值的校验/转换，抛错则回退为 initialValue
 * @returns [value, setValue]，setValue 支持直接传值或 (prev) => newValue
 *
 * @example
 * const [name, setName] = useLocalStorage("user_name", "guest");
 * const [settings, setSettings] = useLocalStorage("settings", () => ({ theme: "dark" }));
 */
export function useLocalStorage<T>(
  key: string,
  initialValue: T | (() => T),
  options?: UseLocalStorageOptions<T>
): [T, (value: T | ((prev: T) => T)) => void] {
  const parse = options?.parse;
  const [state, setState] = useState<T>(() => {
    const init =
      typeof initialValue === "function"
        ? (initialValue as () => T)()
        : initialValue;
    return getStored(key, init, parse);
  });

  const setValue = useCallback(
    (value: T | ((prev: T) => T)) => {
      setState((prev) => {
        const next = typeof value === "function" ? (value as (p: T) => T)(prev) : value;
        setStored(key, next);
        return next;
      });
    },
    [key]
  );

  return [state, setValue];
}
