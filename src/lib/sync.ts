/**
 * Cloud sync. Runs entirely in the browser with the Supabase client (RLS protects data),
 * so it also works inside the Android app, which has no server.
 * localStorage stays the source of truth; the account is a merged backup + share channel.
 */
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { loadAllDecks, saveAllDecks, type Card, type Deck } from "./decks";
import { loadLog, loadSettings, saveLog, saveSettings, type DayLog } from "./study-plan";
import { applySharedDeck, mergeDecks, mergeLogs } from "./sync-merge";

const STATUS_KEY = "flashwords.sync.v1";

export type SyncStatus = {
  /** user id whose account this device is linked to */
  linkedUser?: string;
  lastSync?: number;
  error?: string | undefined;
  syncing?: boolean;
  /** waiting for the user to answer the "upload local decks?" question */
  needsConsent?: boolean;
};

export function loadSyncStatus(): SyncStatus {
  if (typeof window === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem(STATUS_KEY) ?? "{}") as SyncStatus;
  } catch {
    return {};
  }
}
function setStatus(patch: Partial<SyncStatus>) {
  const next = { ...loadSyncStatus(), ...patch };
  localStorage.setItem(STATUS_KEY, JSON.stringify(next));
  window.dispatchEvent(new Event("flashwords:sync"));
  return next;
}

export function useSyncStatus() {
  const [s, set] = useState<SyncStatus>({});
  useEffect(() => {
    const f = () => set(loadSyncStatus());
    f();
    window.addEventListener("flashwords:sync", f);
    return () => window.removeEventListener("flashwords:sync", f);
  }, []);
  return s;
}

/** Answer to the first-login question. upload=false keeps existing local decks on this device only. */
export function resolveConsent(userId: string, upload: boolean) {
  if (!upload) {
    saveAllDecks(
      loadAllDecks().map((d) => (d.sharedDeckId ? d : { ...d, localOnly: true })),
      false,
    );
  }
  setStatus({ linkedUser: userId, needsConsent: false });
  void syncNow();
}

const chunk = <T,>(a: T[], n = 500) =>
  Array.from({ length: Math.ceil(a.length / n) }, (_, i) => a.slice(i * n, i * n + n));

let running: Promise<void> | null = null;

export function syncNow(): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  if (running) return running;
  running = doSync().finally(() => {
    running = null;
  });
  return running;
}

async function doSync() {
  const { data: sess } = await supabase.auth.getSession();
  const user = sess.session?.user;
  if (!user) return;
  const uid = user.id;

  const status = loadSyncStatus();
  if (status.linkedUser !== uid) {
    const hasLocal = loadAllDecks().some((d) => !d.deleted && !d.sharedDeckId && !d.localOnly);
    if (hasLocal) {
      setStatus({ needsConsent: true });
      return;
    }
    setStatus({ linkedUser: uid, needsConsent: false });
  }

  setStatus({ syncing: true, error: undefined });
  try {
    // ---- pull
    const [decksR, cardsR, logsR, setR, profR] = await Promise.all([
      supabase.from("decks").select("*").eq("owner_id", uid),
      fetchAllCards(uid),
      supabase.from("daily_logs").select("*").eq("user_id", uid),
      supabase.from("user_settings").select("*").eq("user_id", uid).maybeSingle(),
      supabase.from("profiles").select("disabled").eq("id", uid).maybeSingle(),
    ]);
    for (const r of [decksR, logsR, setR, profR]) if (r.error) throw r.error;
    const disabled = Boolean(profR.data?.disabled);

    const cardsByDeck = new Map<string, Card[]>();
    for (const c of cardsR) {
      const list = cardsByDeck.get(c.deck_id) ?? [];
      list.push({
        id: c.id,
        front: c.front,
        back: c.back,
        hint: c.hint ?? undefined,
        box: c.box,
        due: Number(c.due),
        lapses: c.lapses,
        reviews: c.reviews,
        updatedAt: Number(c.updated_at),
      });
      cardsByDeck.set(c.deck_id, list);
    }
    const remoteDecks: Deck[] = (decksR.data ?? []).map((d) => ({
      id: d.id,
      name: d.name,
      createdAt: Number(d.created_at),
      updatedAt: Number(d.updated_at),
      deleted: d.deleted,
      sharedDeckId: d.shared_deck_id,
      cards: cardsByDeck.get(d.id) ?? [],
    }));
    const remoteSnapshot = new Map(remoteDecks.map((d) => [d.id, d]));

    // ---- merge
    const local = loadAllDecks();
    let merged = mergeDecks(local, remoteDecks);

    // admin-shared decks assigned to me (or everyone)
    const { data: shared, error: shErr } = await supabase.from("shared_decks").select("id,name");
    if (shErr) throw shErr;
    if (shared?.length) {
      const { data: sc, error: scErr } = await supabase
        .from("shared_cards")
        .select("id,shared_deck_id,front,back,hint")
        .in("shared_deck_id", shared.map((s) => s.id));
      if (scErr) throw scErr;
      for (const s of shared) {
        merged = applySharedDeck(merged, s, (sc ?? []).filter((c) => c.shared_deck_id === s.id));
      }
    }
    saveAllDecks(merged, false);

    const remoteLog: Record<string, DayLog> = {};
    for (const l of logsR.data ?? []) remoteLog[l.day] = { learned: l.learned, reviewed: l.reviewed };
    const mergedLog = mergeLogs(loadLog(), remoteLog);
    saveLog(mergedLog);

    const ls = loadSettings();
    const rs = setR.data;
    if (rs && Number(rs.updated_at) > (ls.updatedAt ?? 0)) {
      saveSettings({
        dailyGoal: rs.daily_goal,
        reminderEnabled: rs.reminder_enabled,
        reminderTime: rs.reminder_time,
        updatedAt: Number(rs.updated_at),
      });
    }

    // ---- push (disabled accounts are read-only)
    if (!disabled) {
      const deckRows = [];
      const cardRows = [];
      for (const d of merged) {
        if (d.localOnly) continue;
        const r = remoteSnapshot.get(d.id);
        if (!r || (d.updatedAt ?? 0) > (r.updatedAt ?? 0) || Boolean(d.deleted) !== Boolean(r.deleted)) {
          deckRows.push({
            id: d.id,
            owner_id: uid,
            name: d.name,
            shared_deck_id: d.sharedDeckId ?? null,
            created_at: d.createdAt,
            updated_at: d.updatedAt ?? d.createdAt,
            deleted: Boolean(d.deleted),
          });
        }
        const rc = new Map((r?.cards ?? []).map((c) => [c.id, c.updatedAt ?? 0]));
        for (const c of d.cards) {
          const ru = rc.get(c.id);
          if (ru === undefined || (c.updatedAt ?? 0) > ru) {
            cardRows.push({
              id: c.id,
              deck_id: d.id,
              owner_id: uid,
              front: c.front,
              back: c.back,
              hint: c.hint ?? null,
              box: c.box,
              due: c.due,
              lapses: c.lapses,
              reviews: c.reviews,
              updated_at: c.updatedAt ?? d.createdAt,
            });
          }
        }
      }
      for (const part of chunk(deckRows)) {
        const { error } = await supabase.from("decks").upsert(part, { onConflict: "owner_id,id" });
        if (error) throw error;
      }
      for (const part of chunk(cardRows)) {
        const { error } = await supabase.from("cards").upsert(part, { onConflict: "owner_id,id" });
        if (error) throw error;
      }

      const logRows = Object.entries(mergedLog)
        .filter(([day, l]) => {
          const r = remoteLog[day];
          return !r || r.learned !== l.learned || r.reviewed !== l.reviewed;
        })
        .map(([day, l]) => ({ user_id: uid, day, learned: l.learned, reviewed: l.reviewed }));
      if (logRows.length) {
        const { error } = await supabase.from("daily_logs").upsert(logRows, { onConflict: "user_id,day" });
        if (error) throw error;
      }

      const s = loadSettings();
      if (!rs || (s.updatedAt ?? 0) > Number(rs.updated_at)) {
        const { error } = await supabase.from("user_settings").upsert({
          user_id: uid,
          daily_goal: s.dailyGoal,
          reminder_enabled: s.reminderEnabled,
          reminder_time: s.reminderTime,
          updated_at: s.updatedAt ?? Date.now(),
        });
        if (error) throw error;
      }
      await supabase.from("profiles").update({ last_active_at: new Date().toISOString() }).eq("id", uid);
    }

    setStatus({
      syncing: false,
      lastSync: Date.now(),
      error: disabled ? "账号已被停用：只能下载，无法上传学习记录。" : undefined,
    });
  } catch (e) {
    setStatus({ syncing: false, error: e instanceof Error ? e.message : "同步失败" });
  }
}

async function fetchAllCards(uid: string) {
  type Row = {
    id: string; deck_id: string; front: string; back: string; hint: string | null;
    box: number; due: number; lapses: number; reviews: number; updated_at: number;
  };
  const out: Row[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await supabase
      .from("cards")
      .select("id,deck_id,front,back,hint,box,due,lapses,reviews,updated_at")
      .eq("owner_id", uid)
      .range(from, from + 999);
    if (error) throw error;
    out.push(...(data as Row[]));
    if (!data || data.length < 1000) return out;
  }
}

/** Sync on open, on sign-in, when the app comes back to front, and 3 s after each change. */
export function useAutoSync() {
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const soon = () => {
      clearTimeout(timer);
      timer = setTimeout(() => void syncNow(), 3000);
    };
    void syncNow();
    const { data } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_IN") void syncNow();
    });
    const vis = () => document.visibilityState === "visible" && void syncNow();
    window.addEventListener("flashwords:dirty", soon);
    document.addEventListener("visibilitychange", vis);
    return () => {
      clearTimeout(timer);
      data.subscription.unsubscribe();
      window.removeEventListener("flashwords:dirty", soon);
      document.removeEventListener("visibilitychange", vis);
    };
  }, []);
}
