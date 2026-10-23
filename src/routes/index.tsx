import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { BookOpen, Plus, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { parseCsv, rowsToCards } from "@/lib/csv";
import { useDecks, makeDeck, dueCards, deckProgress } from "@/lib/decks";
import { newCards, useStudyPlan } from "@/lib/study-plan";
import { StudySettings } from "@/components/study-settings";
import { useWebMCP } from "use-webmcp-tool";
import { runWebMCPTool } from "@/lib/webmcp-telemetry";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "词卡 FlashWords — 导入 CSV 背单词" },
      {
        name: "description",
        content: "导入 CSV 单词表，生成翻转卡片，用间隔重复高效记单词。手机与电脑均可使用，可添加到主屏幕。",
      },
      { property: "og:title", content: "词卡 FlashWords — 导入 CSV 背单词" },
      {
        property: "og:description",
        content: "导入 CSV 单词表，生成翻转卡片，用间隔重复高效记单词。",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Home,
});

function Home() {
  const { decks, ready, addDeck, removeDeck } = useDecks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const { settings, today, streak } = useStudyPlan();
  const totalDue = decks.reduce((n, d) => n + dueCards(d).length, 0);
  const totalNew = decks.reduce((n, d) => n + newCards(d).length, 0);
  const goalPct = Math.min(100, Math.round((today.learned / settings.dailyGoal) * 100));

  useWebMCP({
    name: "list_visible_decks",
    description: "Read the decks and review counts shown on the current library screen; no changes are made.",
    enabled: ready,
    annotations: { readOnlyHint: true, untrustedContentHint: true },
    execute: () => runWebMCPTool("list_visible_decks", () => decks.length === 0 ? "No decks shown." : decks.map((deck) => `${deck.id}: ${deck.name}; ${deck.cards.length} cards; ${dueCards(deck).length} due; ${deckProgress(deck)}% mastered.`).join("\n")),
  });

  async function handleFile(file: File) {
    setError(null);
    try {
      const text = await file.text();
      const cards = rowsToCards(parseCsv(text));
      if (cards.length === 0) {
        setError("没有识别到卡片。请确保每行至少有两列：正面、背面。");
        return;
      }
      addDeck(makeDeck(file.name.replace(/\.csv$/i, ""), cards));
    } catch {
      setError("文件读取失败，请重试。");
    }
  }

  return (
    <main className="mx-auto min-h-screen w-full max-w-2xl px-5 pb-24 pt-10">
      <header className="mb-8">
        <div className="flex items-center justify-between gap-4">
          <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">FLASHCARDS</p>
          <StudySettings />
        </div>
        <h1 className="mt-2 text-4xl leading-tight tracking-tight">(╬ Ò ‸ Ó)σ 乖乖背词语</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          这个app会自动帮你复习词语！
        </p>
      </header>

      {ready && decks.length > 0 && (
        <section className="mb-6 rounded-3xl bg-card p-5 shadow-card" aria-label="今日进度">
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="text-sm font-medium">今日目标</h2>
            {streak > 0 && <span className="text-xs text-muted-foreground">已连续 {streak} 天</span>}
          </div>
          <p className="mt-2 text-3xl tabular-nums">
            {Math.min(today.learned, settings.dailyGoal)}
            <span className="text-base text-muted-foreground"> / {settings.dailyGoal} 个新词</span>
          </p>
          <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${goalPct}%` }} />
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            {totalDue > 0 ? <span className="text-accent-foreground">{totalDue} 个词语待复习</span> : "暂无到期复习"}
            {" · "}今天已复习 {today.reviewed} 次
            {totalNew === 0 && " · 新词已全部学完"}
          </p>
        </section>
      )}

      <label
        className="flex cursor-pointer flex-col items-center gap-3 rounded-3xl border border-dashed border-border bg-card px-6 py-10 text-center shadow-card transition-colors hover:border-primary/60"
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const f = e.dataTransfer.files?.[0];
          if (f) void handleFile(f);
        }}
      >
        <span className="flex size-12 items-center justify-center rounded-2xl bg-secondary text-primary">
          <Upload className="size-5" />
        </span>
        <span className="text-base font-medium">导入 CSV 词表</span>
        <span className="text-xs text-muted-foreground">
          点击选择文件，或将文件拖到这里
          <br />
          列格式：单词, 释义, 例句（可选）
        </span>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFile(f);
            e.target.value = "";
          }}
        />
      </label>

      {error && <p className="mt-4 text-sm text-destructive">{error}</p>}

      <section className="mt-10">
        <h2 className="mb-4 text-sm font-medium uppercase tracking-[0.18em] text-muted-foreground">
          我的词库
        </h2>

        {!ready ? null : decks.length === 0 ? (
          <div className="rounded-3xl bg-secondary/60 px-6 py-10 text-center text-sm text-muted-foreground">
            还没有词库，先导入一个 CSV 文件吧。
          </div>
        ) : (
          <ul className="space-y-3">
            {decks.map((deck) => {
              const due = dueCards(deck).length;
              const fresh = newCards(deck).length;
              const progress = deckProgress(deck);
              return (
                <li
                  key={deck.id}
                  className="group rounded-3xl bg-card p-5 shadow-card transition-shadow hover:shadow-lift"
                >
                  <div className="flex items-start justify-between gap-4">
                    <Link
                      to="/study/$deckId"
                      params={{ deckId: deck.id }}
                      className="min-w-0 flex-1"
                    >
                      <p className="truncate text-lg font-medium">{deck.name}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {deck.cards.length} 张卡片 · 已掌握 {progress}%
                        {due > 0 && <span className="text-accent-foreground"> · {due} 个待复习</span>}
                        {fresh > 0 && <span> · {fresh} 个新词</span>}
                      </p>
                      <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
                        <div
                          className="h-full rounded-full bg-primary transition-all"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    </Link>
                    <div className="flex shrink-0 items-center gap-2">
                      <Link
                        to="/study/$deckId"
                        params={{ deckId: deck.id }}
                        className="flex size-10 items-center justify-center rounded-full bg-primary text-primary-foreground transition-transform active:scale-95"
                        aria-label={`开始学习 ${deck.name}`}
                      >
                        <BookOpen className="size-4" />
                      </Link>
                      <button
                        onClick={() => removeDeck(deck.id)}
                        className="flex size-10 items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-secondary hover:text-destructive"
                        aria-label={`删除 ${deck.name}`}
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="mt-12 rounded-3xl border border-border/70 bg-secondary/40 p-5">
        <h2 className="flex items-center gap-2 text-sm font-medium">
          <FileSpreadsheet className="size-4 text-primary" /> CSV 格式示例
        </h2>
        <pre className="mt-3 overflow-x-auto rounded-2xl bg-card p-4 text-xs leading-relaxed text-muted-foreground">
{`word,meaning,example
abandon,放弃；抛弃,He abandoned the plan.
brisk,轻快的；活跃的,a brisk walk`}
        </pre>
        <p className="mt-3 text-xs text-muted-foreground">
          也支持无表头文件（第一列单词，第二列释义），逗号、分号或制表符分隔均可。
        </p>
      </section>

      <button
        onClick={() => fileRef.current?.click()}
        className="fixed bottom-6 right-6 flex items-center gap-2 rounded-full bg-primary px-5 py-3.5 text-sm font-medium text-primary-foreground shadow-lift transition-transform active:scale-95 sm:hidden"
      >
        <Plus className="size-4" /> 导入
      </button>
    </main>
  );
}
