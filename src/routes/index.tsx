import { createFileRoute, Link } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { BookOpen, Plus, Trash2, Upload, FileSpreadsheet } from "lucide-react";
import { parseCsv, rowsToCards } from "@/lib/csv";
import { useDecks, makeDeck, dueCards, deckProgress } from "@/lib/decks";

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
    ],
  }),
  component: Home,
});

function Home() {
  const { decks, ready, addDeck, removeDeck } = useDecks();
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);

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
        <p className="text-xs uppercase tracking-[0.28em] text-muted-foreground">FlashWords</p>
        <h1 className="mt-2 text-4xl leading-tight tracking-tight">词卡</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          导入 .csv 单词表，翻卡记忆，自动安排复习。
        </p>
      </header>

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
                        {due > 0 && <span className="text-accent-foreground"> · {due} 张待复习</span>}
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
