import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, RotateCcw, Volume2, X } from "lucide-react";
import { useDecks, gradeCard, dueCards, type Card } from "@/lib/decks";
import { useSpeak } from "@/lib/tts";

export const Route = createFileRoute("/study/$deckId")({
  head: () => ({
    meta: [
      { title: "学习中 — 词卡 FlashWords" },
      { name: "description", content: "翻转卡片，标记记得或忘记，系统自动安排下次复习时间。" },
      { property: "og:title", content: "学习中 — 词卡 FlashWords" },
      { property: "og:description", content: "翻转卡片记单词，自动安排复习。" },
    ],
  }),
  component: StudyPage,
});

function StudyPage() {
  const { deckId } = useParams({ from: "/study/$deckId" });
  const { decks, ready, updateDeck } = useDecks();
  const deck = decks.find((d) => d.id === deckId);

  const [queue, setQueue] = useState<string[] | null>(null);
  const [flipped, setFlipped] = useState(false);
  const [stats, setStats] = useState({ known: 0, again: 0 });
  const [autoPlay, setAutoPlay] = useState(true);
  const { speak, speaking } = useSpeak();

  useEffect(() => {
    if (!deck || queue !== null) return;
    const due = dueCards(deck);
    const pool = due.length > 0 ? due : deck.cards;
    setQueue(shuffle(pool.map((c) => c.id)));
  }, [deck, queue]);

  const current: Card | undefined = useMemo(() => {
    if (!deck || !queue || queue.length === 0) return undefined;
    return deck.cards.find((c) => c.id === queue[0]!);
  }, [deck, queue]);

  const currentFront = current?.front;
  useEffect(() => {
    if (!autoPlay || !currentFront) return;
    speak(currentFront);
  }, [currentFront, autoPlay, speak]);

  if (!ready) return null;

  if (!deck) {
    return (
      <Empty title="词库不存在" hint="它可能已被删除。" />
    );
  }

  if (deck.cards.length === 0) {
    return <Empty title="这个词库还没有卡片" hint="返回首页重新导入 CSV。" />;
  }

  function answer(known: boolean) {
    if (!current || !queue) return;
    updateDeck(deckId, (d) => ({
      ...d,
      cards: d.cards.map((c) => (c.id === current.id ? gradeCard(c, known) : c)),
    }));
    setStats((s) => ({ known: s.known + (known ? 1 : 0), again: s.again + (known ? 0 : 1) }));
    setFlipped(false);
    setQueue(known ? queue.slice(1) : [...queue.slice(1), queue[0]!]);
  }

  const total = deck.cards.length;
  const remaining = queue?.length ?? 0;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-5 pb-8 pt-6">
      <div className="flex items-center justify-between gap-4">
        <Link
          to="/"
          className="flex size-10 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card"
          aria-label="返回"
        >
          <ArrowLeft className="size-4" />
        </Link>
        <p className="min-w-0 flex-1 truncate text-center text-sm font-medium">{deck.name}</p>
        <span className="w-10 text-right text-xs text-muted-foreground">{remaining}</span>
      </div>

      <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary transition-all duration-300"
          style={{ width: `${total ? ((total - remaining) / total) * 100 : 0}%` }}
        />
      </div>

      {!current ? (
        <div className="flex flex-1 flex-col items-center justify-center text-center">
          <p className="text-3xl">🎉</p>
          <h1 className="mt-4 text-2xl">这一轮完成了</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            记住 {stats.known} 次 · 需重来 {stats.again} 次
          </p>
          <div className="mt-8 flex gap-3">
            <button
              onClick={() => {
                setStats({ known: 0, again: 0 });
                setQueue(shuffle(deck.cards.map((c) => c.id)));
              }}
              className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
            >
              <RotateCcw className="size-4" /> 再来一轮
            </button>
            <Link
              to="/"
              className="rounded-full bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground"
            >
              回到词库
            </Link>
          </div>
        </div>
      ) : (
        <>
          <div className="card-flip-scene flex flex-1 items-center py-6">
            <button
              onClick={() => setFlipped((f) => !f)}
              className="card-flip-inner relative block h-[52vh] max-h-[420px] min-h-[280px] w-full"
              style={{ transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)" }}
              aria-label="翻转卡片"
            >
              <Face>
                <p className="text-3xl leading-snug sm:text-4xl">{current.front}</p>
                <p className="mt-6 text-xs uppercase tracking-[0.2em] text-muted-foreground">
                  点击查看释义
                </p>
              </Face>
              <Face back>
                <p className="text-2xl leading-snug sm:text-3xl">{current.back}</p>
                {current.hint && (
                  <p className="mt-4 max-w-sm text-sm italic text-muted-foreground">{current.hint}</p>
                )}
              </Face>
            </button>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => answer(false)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-card py-4 text-sm font-medium text-destructive shadow-card transition-transform active:scale-[0.98]"
            >
              <X className="size-4" /> 还不熟
            </button>
            <button
              onClick={() => answer(true)}
              className="flex items-center justify-center gap-2 rounded-2xl bg-primary py-4 text-sm font-medium text-primary-foreground shadow-card transition-transform active:scale-[0.98]"
            >
              <Check className="size-4" /> 记住了
            </button>
          </div>
        </>
      )}
    </main>
  );
}

function Face({ children, back = false }: { children: React.ReactNode; back?: boolean }) {
  return (
    <div
      className="card-flip-face absolute inset-0 flex flex-col items-center justify-center rounded-3xl bg-card px-8 text-center shadow-lift"
      style={back ? { transform: "rotateY(180deg)" } : undefined}
    >
      {children}
    </div>
  );
}

function Empty({ title, hint }: { title: string; hint: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center px-6 text-center">
      <h1 className="text-2xl">{title}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{hint}</p>
      <Link
        to="/"
        className="mt-6 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
      >
        返回首页
      </Link>
    </main>
  );
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j]!, a[i]!];
  }
  return a;
}
