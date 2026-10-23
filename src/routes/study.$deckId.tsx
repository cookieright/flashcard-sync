import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, Check, Plus, RotateCcw, Volume2, X } from "lucide-react";
import { useDecks, gradeCard, type Card } from "@/lib/decks";
import {
  buildSession,
  formatWhen,
  isNew,
  newCards,
  nextReviewAt,
  recordAnswer,
  useStudyPlan,
} from "@/lib/study-plan";
import { useSpeak } from "@/lib/tts";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

export const Route = createFileRoute("/study/$deckId")({
  head: () => ({
    meta: [
      { title: "学习中 — 词卡 FlashWords" },
      { name: "description", content: "翻转卡片，标记记得或忘记，系统自动安排下次复习时间。" },
      { property: "og:title", content: "学习中 — 词卡 FlashWords" },
      { property: "og:description", content: "翻转卡片记单词，自动安排复习。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
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
  const [sessionSize, setSessionSize] = useState(0);
  const [practice, setPractice] = useState(false);
  const { settings, today } = useStudyPlan();
  const [autoPlay, setAutoPlay] = useState(true);
  const { speak, speaking } = useSpeak();

  useEffect(() => {
    if (!deck || queue !== null) return;
    const session = buildSession(deck);
    setSessionSize(session.length);
    setQueue(session.map((c) => c.id));
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

  useWebMCP({
    name: "read_current_flashcard",
    description: "Read only the current visible side of the study card and remaining card count, without revealing the hidden answer.",
    enabled: ready && Boolean(deck) && queue !== null,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("read_current_flashcard", () => current ? `${current.id}: ${flipped ? current.back : current.front}${flipped && current.hint ? `; ${current.hint}` : ""}; remaining: ${queue?.length ?? 0}.` : "Study round complete."),
  });

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
    if (!practice) {
      recordAnswer(isNew(current));
      updateDeck(deckId, (d) => ({
        ...d,
        cards: d.cards.map((c) => (c.id === current.id ? gradeCard(c, known) : c)),
      }));
    }
    setStats((s) => ({ known: s.known + (known ? 1 : 0), again: s.again + (known ? 0 : 1) }));
    setFlipped(false);
    setQueue(known ? queue.slice(1) : [...queue.slice(1), queue[0]!]);
  }

  const total = sessionSize;
  const remaining = queue?.length ?? 0;
  const freshLeft = newCards(deck).length;
  const next = nextReviewAt([deck]);

  function startRound(ids: string[], asPractice = false) {
    setPractice(asPractice);
    setStats({ known: 0, again: 0 });
    setFlipped(false);
    setSessionSize(ids.length);
    setQueue(ids);
  }

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
          <h1 className="mt-4 text-2xl">
            {total > 0 ? "这一轮完成了" : "今天这个词库的任务完成了"}
          </h1>
          {total > 0 && (
            <p className="mt-2 text-sm text-muted-foreground">
              记住 {stats.known} 次 · 需重来 {stats.again} 次
            </p>
          )}
          <p className="mt-2 text-sm text-muted-foreground">
            今日新词 {Math.min(today.learned, settings.dailyGoal)}/{settings.dailyGoal}
            {today.learned > settings.dailyGoal && `（超额 ${today.learned - settings.dailyGoal}）`}
            {" · "}复习 {today.reviewed} 次
          </p>
          {next && (
            <p className="mt-1 text-xs text-muted-foreground">下一次复习：{formatWhen(next)}</p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            {freshLeft > 0 && (
              <button
                onClick={() => startRound(newCards(deck).slice(0, 5).map((c) => c.id))}
                className="flex items-center gap-2 rounded-full bg-primary px-5 py-3 text-sm font-medium text-primary-foreground"
              >
                <Plus className="size-4" /> 再学 5 个新词
              </button>
            )}
            <button
              onClick={() =>
                startRound(shuffle(deck.cards.filter((c) => !isNew(c)).map((c) => c.id)), true)
              }
              disabled={deck.cards.every(isNew)}
              className="flex items-center gap-2 rounded-full bg-secondary px-5 py-3 text-sm font-medium text-secondary-foreground disabled:opacity-50"
            >
              <RotateCcw className="size-4" /> 自由练习学过的词
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
                <span className="absolute left-5 top-5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">
                  {practice ? "自由练习" : isNew(current) ? "新词" : "复习"}
                </span>
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

          <div className="mb-3 flex items-center justify-center gap-3">
            <button
              onClick={() => speak(current.front)}
              className={`flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm font-medium shadow-card transition-transform active:scale-[0.97] ${
                speaking ? "text-primary" : "text-muted-foreground"
              }`}
              aria-label="播放读音"
            >
              <Volume2 className="size-4" /> 播放读音
            </button>
            <button
              onClick={() => setAutoPlay((v) => !v)}
              className={`rounded-full px-3 py-2 text-xs font-medium transition-colors ${
                autoPlay
                  ? "bg-primary/10 text-primary"
                  : "bg-secondary text-muted-foreground"
              }`}
            >
              {autoPlay ? "自动朗读：开" : "自动朗读：关"}
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
