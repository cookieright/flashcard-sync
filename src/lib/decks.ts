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
};

export type Deck = {
  id: string;
  name: string;
  createdAt: number;
  cards: Card[];
};

const STORAGE_KEY = "flashwords.decks.v1";

const INTERVALS_MIN = [0, 10, 60 * 24, 60 * 24 * 3, 60 * 24 * 7, 60 * 24 * 21];

export function loadDecks(): Deck[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Deck[]) : [];
  } catch {
    return [];
  }
}

export function saveDecks(decks: Deck[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(decks));
  window.dispatchEvent(new Event("flashwords:change"));
}

function uid() {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

export function makeDeck(name: string, cards: CsvCard[]): Deck {
  return {
    id: uid(),
    name,
    createdAt: Date.now(),
    cards: cards.map((c) => ({
      id: uid(),
      front: c.front,
      back: c.back,
      hint: c.hint,
      box: 0,
      due: Date.now(),
      lapses: 0,
      reviews: 0,
    })),
  };
}

export function gradeCard(card: Card, known: boolean): Card {
  const box = known ? Math.min(card.box + 1, INTERVALS_MIN.length - 1) : 0;
  return {
    ...card,
    box,
    reviews: card.reviews + 1,
    lapses: known ? card.lapses : card.lapses + 1,
    due: Date.now() + INTERVALS_MIN[box]! * 60 * 1000,
  };
}

export function dueCards(deck: Deck, now = Date.now()) {
  return deck.cards.filter((c) => c.due <= now);
}

export function deckProgress(deck: Deck) {
  if (deck.cards.length === 0) return 0;
  const mastered = deck.cards.filter((c) => c.box >= 4).length;
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
    saveDecks([deck, ...loadDecks()]);
  }, []);

  const removeDeck = useCallback((id: string) => {
    saveDecks(loadDecks().filter((d) => d.id !== id));
  }, []);

  const updateDeck = useCallback((id: string, fn: (d: Deck) => Deck) => {
    saveDecks(loadDecks().map((d) => (d.id === id ? fn(d) : d)));
  }, []);

  return { decks, ready, addDeck, removeDeck, updateDeck };
}
