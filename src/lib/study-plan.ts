import { useCallback, useEffect, useState } from "react";
import { loadDecks, type Card, type Deck } from "./decks";

/* ------------------------------------------------------------------ */
/* Settings                                                            */
/* ------------------------------------------------------------------ */

export const GOAL_OPTIONS = [5, 10, 15, 20, 25, 30, 35, 40, 45, 50] as const;

export type Settings = {
  /** New words to learn per day (5–50, step 5). */
  dailyGoal: number;
  reminderEnabled: boolean;
  /** "HH:MM", 24h, local time. */
  reminderTime: string;
};

const SETTINGS_KEY = "flashwords.settings.v1";
const DEFAULT_SETTINGS: Settings = { dailyGoal: 10, reminderEnabled: false, reminderTime: "20:00" };

export function loadSettings(): Settings {
  if (typeof window === "undefined") return DEFAULT_SETTINGS;
  try {
    const raw = window.localStorage.getItem(SETTINGS_KEY);
    const s = { ...DEFAULT_SETTINGS, ...(raw ? (JSON.parse(raw) as Partial<Settings>) : {}) };
    const goal = Math.round(Number(s.dailyGoal) / 5) * 5;
    s.dailyGoal = Math.min(50, Math.max(5, Number.isFinite(goal) ? goal : 10));
    if (!/^\d{2}:\d{2}$/.test(s.reminderTime)) s.reminderTime = DEFAULT_SETTINGS.reminderTime;
    return s;
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function saveSettings(patch: Partial<Settings>) {
  const next = { ...loadSettings(), ...patch };
  window.localStorage.setItem(SETTINGS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("flashwords:change"));
  return next;
}

/* ------------------------------------------------------------------ */
/* Daily log                                                           */
/* ------------------------------------------------------------------ */

type DayLog = { learned: number; reviewed: number };
const LOG_KEY = "flashwords.daily.v1";

export function dayKey(d = new Date()) {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

function loadLog(): Record<string, DayLog> {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(window.localStorage.getItem(LOG_KEY) ?? "{}") as Record<string, DayLog>;
  } catch {
    return {};
  }
}

export function todayLog(): DayLog {
  return loadLog()[dayKey()] ?? { learned: 0, reviewed: 0 };
}

/** Call once per answered card. `wasNew` = the card had never been studied before. */
export function recordAnswer(wasNew: boolean) {
  const log = loadLog();
  const key = dayKey();
  const day = log[key] ?? { learned: 0, reviewed: 0 };
  if (wasNew) day.learned += 1;
  else day.reviewed += 1;
  log[key] = day;
  // keep ~3 months of history
  for (const k of Object.keys(log).sort().slice(0, -90)) delete log[k];
  window.localStorage.setItem(LOG_KEY, JSON.stringify(log));
  window.dispatchEvent(new Event("flashwords:change"));
}

/** Consecutive days (ending today or yesterday) with any study. */
export function streakDays(): number {
  const log = loadLog();
  const d = new Date();
  const active = (k: string) => (log[k]?.learned ?? 0) + (log[k]?.reviewed ?? 0) > 0;
  if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (active(dayKey(d))) {
    n += 1;
    d.setDate(d.getDate() - 1);
  }
  return n;
}

/* ------------------------------------------------------------------ */
/* What to study                                                       */
/* ------------------------------------------------------------------ */

export const isNew = (c: Card) => c.reviews === 0;

export function dueReviews(deck: Deck, now = Date.now()) {
  return deck.cards.filter((c) => !isNew(c) && c.due <= now).sort((a, b) => a.due - b.due);
}

export function newCards(deck: Deck) {
  return deck.cards.filter(isNew);
}

/** New words still allowed today (across all decks). */
export function newAllowanceToday(settings = loadSettings()) {
  return Math.max(0, settings.dailyGoal - todayLog().learned);
}

/** Today's session for one deck: every due review + new words up to today's goal. */
export function buildSession(deck: Deck, extraNew = 0): Card[] {
  const reviews = dueReviews(deck);
  const fresh = newCards(deck).slice(0, newAllowanceToday() + extraNew);
  return [...reviews, ...fresh];
}

export function nextReviewAt(decks: Deck[]): number | null {
  let next: number | null = null;
  for (const d of decks)
    for (const c of d.cards)
      if (!isNew(c) && c.due > Date.now() && (next === null || c.due < next)) next = c.due;
  return next;
}

export function formatWhen(ts: number) {
  const mins = Math.round((ts - Date.now()) / 60000);
  if (mins < 60) return `${Math.max(1, mins)} 分钟后`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours} 小时后`;
  return `${Math.round(hours / 24)} 天后`;
}

/* ------------------------------------------------------------------ */
/* Reminders                                                           */
/* ------------------------------------------------------------------ */

export type PlannedReminder = { id: number; at: number; title: string; body: string };

declare global {
  interface Window {
    /** Set only inside the Android app (android-app/src/native-reminders.ts). */
    __flashwordsReminders?: {
      /** Ask for notification permission; resolves true when allowed. */
      enable: () => Promise<boolean>;
      /** Replace all scheduled reminders with this list. */
      schedule: (list: PlannedReminder[]) => Promise<void>;
    };
  }
}

export const remindersSupported = () =>
  typeof window !== "undefined" && Boolean(window.__flashwordsReminders);

const REMINDER_DAYS = 14;

/**
 * Plan the next two weeks of reminders. For each day, predicts how many learned words will be
 * due at the reminder time (from the forgetting-curve schedule) plus the day's new-word goal.
 * Re-planned whenever cards or settings change, so the numbers stay current.
 */
export function planReminders(decks: Deck[], settings: Settings, now = Date.now()) {
  if (!settings.reminderEnabled) return [];
  const [hh, mm] = settings.reminderTime.split(":").map(Number);
  const cards = decks.flatMap((d) => d.cards);
  const learned = cards.filter((c) => !isNew(c));
  const fresh = cards.length - learned.length;
  const learnedToday = todayLog().learned;

  const out: PlannedReminder[] = [];
  for (let i = 0; i < REMINDER_DAYS; i++) {
    const at = new Date(now);
    at.setDate(at.getDate() + i);
    at.setHours(hh ?? 20, mm ?? 0, 0, 0);
    if (at.getTime() <= now + 30_000) continue;

    const due = learned.filter((c) => c.due <= at.getTime()).length;
    const goalLeft = i === 0 ? Math.max(0, settings.dailyGoal - learnedToday) : settings.dailyGoal;
    const newLeft = Math.min(goalLeft, Math.max(0, fresh - (i === 0 ? 0 : settings.dailyGoal * i)));
    if (due === 0 && newLeft === 0) continue;

    const parts = [];
    if (due > 0) parts.push(`${due} 个词语该复习了`);
    if (newLeft > 0) parts.push(`还有 ${newLeft} 个新词等你学`);
    out.push({
      id: 1000 + i,
      at: at.getTime(),
      title: "(╬ Ò ‸ Ó)σ 乖乖背词语",
      body: `${parts.join("，")}。趁现在花几分钟吧！`,
    });
  }
  return out;
}

/** Keep the phone's scheduled reminders in sync with decks + settings (Android app only). */
export function useReminderSync() {
  useEffect(() => {
    const api = window.__flashwordsReminders;
    if (!api) return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const sync = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        void api.schedule(planReminders(loadDecks(), loadSettings())).catch(() => {});
      }, 800);
    };
    sync();
    window.addEventListener("flashwords:change", sync);
    document.addEventListener("visibilitychange", sync);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("flashwords:change", sync);
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
}

/** Reactive settings + today's progress. */
export function useStudyPlan() {
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [today, setToday] = useState<DayLog>({ learned: 0, reviewed: 0 });
  const [streak, setStreak] = useState(0);

  useEffect(() => {
    const sync = () => {
      setSettings(loadSettings());
      setToday(todayLog());
      setStreak(streakDays());
    };
    sync();
    window.addEventListener("flashwords:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("flashwords:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<Settings>) => setSettings(saveSettings(patch)), []);
  return { settings, today, streak, update };
}
