import { useCallback, useEffect, useState } from "react";
import type { CsvCard } from "./csv";

export type Card = {
  id: string;
  front: string;
  back: string;
  hint?: string | undefined;
  /** spaced repetition state */
  box: number; // 0..5
  due: number; // epoch ms
  lapses: number;
  reviews: number;
  /** last local change, epoch ms (used for cloud sync merge) */
  updatedAt?: number;
};

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
  updatedAt?: number;
  /** soft delete, kept locally so the deletion can sync */
  deleted?: boolean;
  /** set when this deck came from an admin-shared deck */
  sharedDeckId?: string | null;
  /** user chose not to upload this deck to their account */
  localOnly?: boolean;
};

const STORAGE_KEY = "flashwords.decks.v1";

/**
 * Review intervals following the Ebbinghaus forgetting curve:
 * 5 min → 30 min → 12 h → 1 d → 2 d → 4 d → 7 d → 15 d → 30 d.
 * "记住了" moves a card one step up; "还不熟" sends it back to the start.
 */
export const INTERVALS_MIN = [
  0,
  5,
  30,
  60 * 12,
  60 * 24,
  60 * 24 * 2,
  60 * 24 * 4,
  60 * 24 * 7,
  60 * 24 * 15,
  60 * 24 * 30,
];

/** Cards at or beyond this step (passed the 4-day review) count as mastered. */
export const MASTERED_BOX = 6;

/** Visible (non-deleted) decks. */
export function loadDecks(): Deck[] {
  return loadAllDecks().filter((d) => !d.deleted);
}

/** All decks including soft-deleted tombstones. */
export function loadAllDecks(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Deck[]) : [];
  } catch {
    return [];
  }
}

/** Writes all decks (including tombstones). `dirty` marks a user change that should sync. */
export function saveAllDecks(decks: Deck[], dirty = true) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  window.dispatchEvent(new Event("flashwords:change"));
  if (dirty) window.dispatchEvent(new Event("flashwords:dirty"));
}

/** Replace visible decks, keeping tombstones. */
export function saveDecks(decks: Deck[]) {
  const ids = new Set(decks.map((d) => d.id));
  saveAllDecks([...decks, ...loadAllDecks().filter((d) => d.deleted && !ids.has(d.id))]);
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function makeDeck(name: string, cards: CsvCard[]): Deck {
  const now = Date.now();
  return {
    id: uid(),
    name,
    createdAt: now,
    updatedAt: now,
    cards: cards.map((c) => ({
      id: uid(),
      front: c.front,
      back: c.back,
      hint: c.hint,
      box: 0,
      due: Date.now(),
      lapses: 0,
      reviews: 0,
      updatedAt: now,
    })),
  };
}

export function gradeCard(card: Card, known: boolean): Card {
  const box = known ? Math.min(card.box + 1, INTERVALS_MIN.length - 1) : 1;
  return {
    ...card,
    box,
    reviews: card.reviews + 1,
    lapses: known ? card.lapses : card.lapses + 1,
    due: Date.now() + INTERVALS_MIN[box]! * 60 * 1000,
    updatedAt: Date.now(),
  };
}

/** Studied cards whose next review time has arrived (never-studied cards are not "due"). */
export function dueCards(deck: Deck, now = Date.now()) {
  return deck.cards.filter((c) => c.reviews > 0 && c.due <= now);
}

export function deckProgress(deck: Deck) {
  if (deck.cards.length === 0) return 0;
  const mastered = deck.cards.filter((c) => c.box >= MASTERED_BOX).length;
  return Math.round((mastered / deck.cards.length) * 100);
}

/** Reactive access to decks in localStorage. */
export function useDecks() {
  const [decks, setDecks] = useState<Deck[]>([]);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setDecks(loadDecks());
    sync();
    setReady(true);
    window.addEventListener("flashwords:change", sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener("flashwords:change", sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const addDeck = useCallback((deck: Deck) => {
    saveAllDecks([deck, ...loadAllDecks()]);
  }, []);

  const removeDeck = useCallback((id: string) => {
    saveAllDecks(
      loadAllDecks().map((d) => (d.id === id ? { ...d, deleted: true, updatedAt: Date.now() } : d)),
    );
  }, []);

  const updateDeck = useCallback((id: string, fn: (d: Deck) => Deck) => {
    saveAllDecks(loadAllDecks().map((d) => (d.id === id ? fn(d) : d)));
  }, []);

  return { decks, ready, addDeck, removeDeck, updateDeck };
}
