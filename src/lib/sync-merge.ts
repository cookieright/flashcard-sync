import type { Card, Deck } from "./decks";
import type { DayLog } from "./study-plan";

const ts = (n: number | undefined) => n ?? 0;

/** Merge two card lists by id; the newer updatedAt wins (local wins ties). */
export function mergeCards(local: Card[], remote: Card[]): Card[] {
  const out = new Map<string, Card>();
  for (const c of remote) out.set(c.id, c);
  for (const c of local) {
    const r = out.get(c.id);
    if (!r || ts(c.updatedAt) >= ts(r.updatedAt)) out.set(c.id, c);
  }
  // keep local order first, then remote-only cards
  const order = [...local.map((c) => c.id), ...remote.map((c) => c.id)];
  return [...new Set(order)].map((id) => out.get(id)!);
}

/** Merge decks by id: deck fields from the newer side, cards merged individually. */
export function mergeDecks(local: Deck[], remote: Deck[]): Deck[] {
  const remoteById = new Map(remote.map((d) => [d.id, d]));
  const out: Deck[] = [];
  const seen = new Set<string>();
  for (const l of local) {
    seen.add(l.id);
    const r = remoteById.get(l.id);
    if (!r) {
      out.push(l);
      continue;
    }
    const base = ts(l.updatedAt) >= ts(r.updatedAt) ? l : r;
    out.push({
      ...base,
      localOnly: l.localOnly,
      deleted: Boolean(l.deleted || r.deleted) && base.deleted !== false ? base.deleted : base.deleted,
      cards: mergeCards(l.cards, r.cards),
    });
  }
  for (const r of remote) if (!seen.has(r.id)) out.push(r);
  return out;
}

/** Daily logs: take the larger value on each side for each day. */
export function mergeLogs(
  local: Record<string, DayLog>,
  remote: Record<string, DayLog>,
): Record<string, DayLog> {
  const out: Record<string, DayLog> = { ...remote };
  for (const [day, l] of Object.entries(local)) {
    const r = out[day];
    out[day] = r
      ? { learned: Math.max(l.learned, r.learned), reviewed: Math.max(l.reviewed, r.reviewed) }
      : l;
  }
  return out;
}

export type SharedCardRow = { id: string; front: string; back: string; hint: string | null };

export const sharedDeckLocalId = (sharedDeckId: string) => `sd-${sharedDeckId}`;
export const sharedCardLocalId = (sharedCardId: string) => `sc-${sharedCardId}`;

/**
 * Bring an admin-shared deck into the local deck list. Existing study progress is kept;
 * new words from the admin are added; edited word text is updated.
 */
export function applySharedDeck(
  decks: Deck[],
  shared: { id: string; name: string },
  cards: SharedCardRow[],
  now = Date.now(),
): Deck[] {
  const id = sharedDeckLocalId(shared.id);
  const existing = decks.find((d) => d.id === id);
  if (existing?.deleted) return decks; // user removed it; respect that
  const prev = new Map((existing?.cards ?? []).map((c) => [c.id, c]));
  let changed = !existing;
  const nextCards: Card[] = cards.map((sc) => {
    const cid = sharedCardLocalId(sc.id);
    const old = prev.get(cid);
    const hint = sc.hint || undefined;
    if (!old) {
      changed = true;
      return { id: cid, front: sc.front, back: sc.back, hint, box: 0, due: now, lapses: 0, reviews: 0, updatedAt: now };
    }
    if (old.front !== sc.front || old.back !== sc.back || (old.hint || undefined) !== hint) {
      changed = true;
      return { ...old, front: sc.front, back: sc.back, hint, updatedAt: now };
    }
    return old;
  });
  // keep any local cards that are no longer in the shared list only if studied
  for (const c of existing?.cards ?? []) {
    if (!nextCards.some((n) => n.id === c.id) && c.reviews > 0) nextCards.push(c);
  }
  if (existing && existing.name !== shared.name) changed = true;
  if (!changed) return decks;
  const deck: Deck = {
    ...(existing ?? { id, createdAt: now }),
    id,
    name: shared.name,
    sharedDeckId: shared.id,
    updatedAt: now,
    cards: nextCards,
  };
  return existing ? decks.map((d) => (d.id === id ? deck : d)) : [deck, ...decks];
}
