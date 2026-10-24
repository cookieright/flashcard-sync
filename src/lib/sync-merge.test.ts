import { describe, expect, it } from "vitest";
import { applySharedDeck, mergeCards, mergeLogs } from "./sync-merge";
import type { Card, Deck } from "./decks";

const card = (id: string, updatedAt: number, box = 0): Card => ({
  id, front: id, back: id, box, due: 0, lapses: 0, reviews: box, updatedAt,
});

describe("sync merge", () => {
  it("newer updated_at wins per card", () => {
    const out = mergeCards([card("a", 100, 1), card("b", 50, 1)], [card("a", 90, 3), card("b", 60, 4)]);
    expect(out.find((c) => c.id === "a")!.box).toBe(1);
    expect(out.find((c) => c.id === "b")!.box).toBe(4);
  });

  it("daily logs take the larger value", () => {
    const out = mergeLogs({ d: { learned: 5, reviewed: 1 } }, { d: { learned: 2, reviewed: 9 } });
    expect(out["d"]).toEqual({ learned: 5, reviewed: 9 });
  });

  it("shared deck keeps progress and adds new words", () => {
    const decks: Deck[] = [{ id: "sd-x", name: "S", createdAt: 0, sharedDeckId: "x", cards: [card("sc-1", 1, 3)] }];
    const out = applySharedDeck(decks, { id: "x", name: "S" }, [
      { id: "1", front: "sc-1", back: "sc-1", hint: null },
      { id: "2", front: "new", back: "n", hint: null },
    ]);
    expect(out[0]!.cards.find((c) => c.id === "sc-1")!.box).toBe(3);
    expect(out[0]!.cards).toHaveLength(2);
  });
});
