import { useSyncExternalStore } from "react";
import { italian } from "./italian";

export type Language = "zh" | "it";
const STORAGE_KEY = "flashwords.language.v1";
let language: Language = "zh";
const listeners = new Set<() => void>();

export function currentLocale() {
  return language === "it" ? "it-IT" : "zh-CN";
}

export function setLanguage(value: Language) {
  language = value;
  try {
    localStorage.setItem(STORAGE_KEY, value);
  } catch {
    /* Storage can be unavailable. */
  }
  if (typeof document !== "undefined")
    document.documentElement.lang = value === "it" ? "it" : "zh-CN";
  listeners.forEach((listener) => listener());
}

export function restoreLanguage() {
  try {
    setLanguage(localStorage.getItem(STORAGE_KEY) === "it" ? "it" : "zh");
  } catch {
    setLanguage("zh");
  }
}

export function useLanguage() {
  return useSyncExternalStore(
    (listener) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    () => language,
    () => "zh" as Language,
  );
}

export function t(chinese: string, ...values: (string | number)[]) {
  return translate(language, chinese, ...values);
}

function translate(selected: Language, chinese: string, ...values: (string | number)[]) {
  const text = selected === "it" ? (italian[chinese] ?? chinese) : chinese;
  return text.replace(/\{(\d+)\}/g, (match, index: string) =>
    String(values[Number(index)] ?? match),
  );
}

export function useTranslation() {
  const selected = useLanguage();
  return {
    t: (chinese: string, ...values: (string | number)[]) => translate(selected, chinese, ...values),
  };
}

export function localizedWhen(ts: number) {
  const minutes = Math.round((ts - Date.now()) / 60_000);
  const hours = Math.round(minutes / 60);
  if (language === "zh") {
    if (minutes < 60) return `${Math.max(1, minutes)} 分钟后`;
    if (hours < 24) return `${hours} 小时后`;
    return `${Math.round(hours / 24)} 天后`;
  }
  if (minutes < 60) return `Tra ${Math.max(1, minutes)} ${minutes <= 1 ? "minuto" : "minuti"}`;
  if (hours < 24) return `Tra ${hours} ${hours === 1 ? "ora" : "ore"}`;
  const days = Math.round(hours / 24);
  return `Tra ${days} ${days === 1 ? "giorno" : "giorni"}`;
}
