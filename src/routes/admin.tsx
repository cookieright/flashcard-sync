import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, Trash2, Upload } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { parseCsv, rowsToCards } from "@/lib/csv";
import { dayKey } from "@/lib/study-plan";

export const Route = createFileRoute("/admin")({
  ssr: false,
  head: () => ({
    meta: [
      { title: "管理后台 — 乖乖背词语" },
      { name: "description", content: "查看家人和学生的学习情况，下发共享词库。" },
      { property: "og:title", content: "管理后台 — 乖乖背词语" },
      { property: "og:description", content: "学习统计与词库下发。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AdminPage,
});

type Profile = { id: string; display_name: string | null; email: string | null; disabled: boolean; last_active_at: string | null };
type Log = { user_id: string; day: string; learned: number; reviewed: number };
type CardRow = { owner_id: string; deck_id: string; front: string; back: string; box: number; lapses: number };
type DeckRow = { owner_id: string; id: string; name: string; deleted: boolean };

function AdminPage() {
  const [state, setState] = useState<"loading" | "out" | "denied" | "ok">("loading");
  useEffect(() => {
    void supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return setState("out");
      const { data: ok } = await supabase.rpc("has_role", { _user_id: data.user.id, _role: "admin" });
      setState(ok ? "ok" : "denied");
    });
  }, []);
  return (
    <main className="mx-auto min-h-screen max-w-5xl px-5 pb-16 pt-6">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> 返回词库
      </Link>
      <h1 className="mt-3 text-3xl">管理后台</h1>
      {state === "loading" && <p className="mt-6 text-sm text-muted-foreground">加载中…</p>}
      {state === "out" && (
        <p className="mt-6 text-sm">请先 <Link to="/account" className="text-primary underline">登录</Link> 管理员账号。</p>
      )}
      {state === "denied" && <p className="mt-6 text-sm">这个账号没有管理员权限。</p>}
      {state === "ok" && <AdminBody />}
    </main>
  );
}

async function fetchAll<T>(table: "cards" | "decks" | "daily_logs", cols: string, filter?: (q: any) => any): Promise<T[]> {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    let q: any = supabase.from(table).select(cols).range(from, from + 999);
    if (filter) q = filter(q);
    const { data, error } = await q;
    if (error) throw error;
    out.push(...(data as T[]));
    if (!data || data.length < 1000) return out;
  }
}

function AdminBody() {
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [logs, setLogs] = useState<Log[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [decks, setDecks] = useState<DeckRow[]>([]);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const since = new Date();
      since.setDate(since.getDate() - 120);
      const [p, l, c, d] = await Promise.all([
        supabase.from("profiles").select("id,display_name,email,disabled,last_active_at").order("created_at"),
        fetchAll<Log>("daily_logs", "user_id,day,learned,reviewed", (q) => q.gte("day", dayKey(since))),
        fetchAll<CardRow>("cards", "owner_id,deck_id,front,back,box,lapses"),
        fetchAll<DeckRow>("decks", "owner_id,id,name,deleted"),
      ]);
      if (p.error) throw p.error;
      setProfiles(p.data ?? []);
      setLogs(l);
      // only cards in non-deleted decks count
      const live = new Set(d.filter((x) => !x.deleted).map((x) => `${x.owner_id}/${x.id}`));
      setCards(c.filter((x) => live.has(`${x.owner_id}/${x.deck_id}`)));
      setDecks(d.filter((x) => !x.deleted));
    } catch (e) {
      setError(e instanceof Error ? e.message : "加载失败");
    }
  }, []);
  useEffect(() => void load(), [load]);

  async function toggleDisabled(id: string, disabled: boolean) {
    const { error } = await supabase.from("profiles").update({ disabled }).eq("id", id);
    if (error) return setError(error.message);
    setProfiles((ps) => ps.map((p) => (p.id === id ? { ...p, disabled } : p)));
  }

  const today = dayKey();
  const stats = useMemo(
    () =>
      profiles.map((p) => {
        const mine = logs.filter((l) => l.user_id === p.id);
        const byDay = new Map(mine.map((l) => [l.day, l]));
        const t = byDay.get(today);
        const d = new Date();
        const active = (k: string) => ((byDay.get(k)?.learned ?? 0) + (byDay.get(k)?.reviewed ?? 0)) > 0;
        if (!active(dayKey(d))) d.setDate(d.getDate() - 1);
        let streak = 0;
        while (active(dayKey(d))) { streak++; d.setDate(d.getDate() - 1); }
        const c = cards.filter((x) => x.owner_id === p.id);
        const mastery = c.length ? Math.round((c.filter((x) => x.box >= 6).length / c.length) * 100) : 0;
        return { p, learned: t?.learned ?? 0, reviewed: t?.reviewed ?? 0, streak, mastery, total: c.length };
      }),
    [profiles, logs, cards, today],
  );

  return (
    <>
      {error && <p role="alert" className="mt-4 text-sm text-destructive">{error}</p>}
      <Tabs defaultValue="users" className="mt-6">
        <TabsList>
          <TabsTrigger value="users">用户</TabsTrigger>
          <TabsTrigger value="shared">词库下发</TabsTrigger>
        </TabsList>
        <TabsContent value="users">
          <div className="overflow-x-auto rounded-3xl bg-card shadow-card">
            <table className="w-full text-sm">
              <thead className="text-left text-xs text-muted-foreground">
                <tr>
                  {["名字", "邮箱", "今日新词", "今日复习", "连续天数", "掌握率", "最后活跃", "启用"].map((h) => (
                    <th key={h} className="whitespace-nowrap px-4 py-3 font-normal">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {stats.map(({ p, learned, reviewed, streak, mastery, total }) => (
                  <tr key={p.id} className={`border-t border-border ${selected === p.id ? "bg-secondary/60" : ""}`}>
                    <td className="px-4 py-3">
                      <button className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => setSelected(p.id)}>
                        {p.display_name || "（未命名）"}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">{p.email}</td>
                    <td className="px-4 py-3 tabular-nums">{learned}</td>
                    <td className="px-4 py-3 tabular-nums">{reviewed}</td>
                    <td className="px-4 py-3 tabular-nums">{streak}</td>
                    <td className="px-4 py-3 tabular-nums">{mastery}%<span className="text-xs text-muted-foreground"> / {total}词</span></td>
                    <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                      {p.last_active_at ? new Date(p.last_active_at).toLocaleString("zh-CN", { hour12: false }) : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <Switch checked={!p.disabled} onCheckedChange={(v) => void toggleDisabled(p.id, !v)} aria-label="启用账号" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {selected && (
            <UserDetail
              profile={profiles.find((p) => p.id === selected)!}
              logs={logs.filter((l) => l.user_id === selected)}
              cards={cards.filter((c) => c.owner_id === selected)}
              decks={decks.filter((d) => d.owner_id === selected)}
            />
          )}
        </TabsContent>
        <TabsContent value="shared">
          <SharedDecks profiles={profiles} />
        </TabsContent>
      </Tabs>
    </>
  );
}

function UserDetail({ profile, logs, cards, decks }: { profile: Profile; logs: Log[]; cards: CardRow[]; decks: DeckRow[] }) {
  const days = useMemo(() => {
    const byDay = new Map(logs.map((l) => [l.day, l]));
    return Array.from({ length: 30 }, (_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - (29 - i));
      const k = dayKey(d);
      return { k, learned: byDay.get(k)?.learned ?? 0, reviewed: byDay.get(k)?.reviewed ?? 0 };
    });
  }, [logs]);
  const max = Math.max(1, ...days.map((d) => d.learned + d.reviewed));
  const hardest = [...cards].filter((c) => c.lapses > 0).sort((a, b) => b.lapses - a.lapses).slice(0, 20);

  return (
    <section className="mt-6 grid gap-5 md:grid-cols-2">
      <div className="rounded-3xl bg-card p-5 shadow-card md:col-span-2">
        <h2 className="text-lg">{profile.display_name || profile.email} · 最近 30 天</h2>
        <div className="mt-4 flex h-40 items-end gap-1" role="img" aria-label="最近30天每日学习数">
          {days.map((d) => (
            <div key={d.k} className="flex flex-1 flex-col justify-end" title={`${d.k}：新词 ${d.learned}，复习 ${d.reviewed}`}>
              <div className="rounded-t bg-accent" style={{ height: `${(d.reviewed / max) * 100}%` }} />
              <div className="bg-primary" style={{ height: `${(d.learned / max) * 100}%` }} />
            </div>
          ))}
        </div>
        <div className="mt-2 flex justify-between text-xs text-muted-foreground">
          <span>{days[0]!.k.slice(5)}</span>
          <span className="flex gap-3">
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-primary" />新词</span>
            <span><span className="mr-1 inline-block size-2 rounded-sm bg-accent" />复习</span>
          </span>
          <span>今天</span>
        </div>
      </div>
      <div className="rounded-3xl bg-card p-5 shadow-card">
        <h3 className="font-medium">各词库进度</h3>
        <ul className="mt-3 space-y-3 text-sm">
          {decks.length === 0 && <li className="text-muted-foreground">还没有同步词库</li>}
          {decks.map((d) => {
            const c = cards.filter((x) => x.deck_id === d.id);
            const pct = c.length ? Math.round((c.filter((x) => x.box >= 6).length / c.length) * 100) : 0;
            return (
              <li key={d.id}>
                <div className="flex justify-between"><span className="truncate">{d.name}</span><span className="tabular-nums text-muted-foreground">{pct}% · {c.length}词</span></div>
                <div className="mt-1 h-1.5 rounded-full bg-secondary"><div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} /></div>
              </li>
            );
          })}
        </ul>
      </div>
      <div className="rounded-3xl bg-card p-5 shadow-card">
        <h3 className="font-medium">最容易忘的词</h3>
        <ol className="mt-3 space-y-1.5 text-sm">
          {hardest.length === 0 && <li className="text-muted-foreground">暂无</li>}
          {hardest.map((c, i) => (
            <li key={`${c.deck_id}${c.front}${i}`} className="flex justify-between gap-3">
              <span className="truncate">{c.front} <span className="text-muted-foreground">— {c.back}</span></span>
              <span className="shrink-0 tabular-nums text-destructive">忘 {c.lapses} 次</span>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

type Shared = { id: string; name: string; created_at: string };
type SharedCard = { id: string; front: string; back: string; hint: string | null };
type Assign = { id: string; shared_deck_id: string; user_id: string | null };

function SharedDecks({ profiles }: { profiles: Profile[] }) {
  const [list, setList] = useState<Shared[]>([]);
  const [assign, setAssign] = useState<Assign[]>([]);
  const [open, setOpen] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    const [d, a] = await Promise.all([
      supabase.from("shared_decks").select("id,name,created_at").order("created_at", { ascending: false }),
      supabase.from("deck_assignments").select("id,shared_deck_id,user_id"),
    ]);
    setList(d.data ?? []);
    setAssign(a.data ?? []);
  }, []);
  useEffect(() => void load(), [load]);

  async function upload(file: File) {
    setMsg("");
    const cards = rowsToCards(parseCsv(await file.text()));
    if (!cards.length) return setMsg("CSV 里没有找到词语（每行至少两列：正面,背面）。");
    const { data: u } = await supabase.auth.getUser();
    const { data, error } = await supabase
      .from("shared_decks")
      .insert({ name: file.name.replace(/\.csv$/i, ""), created_by: u.user?.id ?? null })
      .select("id")
      .single();
    if (error) return setMsg(error.message);
    const { error: e2 } = await supabase
      .from("shared_cards")
      .insert(cards.map((c) => ({ shared_deck_id: data.id, front: c.front, back: c.back, hint: c.hint ?? null })));
    if (e2) return setMsg(e2.message);
    setMsg(`已创建「${file.name}」，共 ${cards.length} 个词。请在下面选择下发给谁。`);
    setOpen(data.id);
    void load();
  }

  async function remove(id: string) {
    if (!confirm("删除这个共享词库？已经下发到学生手机上的词库会保留。")) return;
    await supabase.from("shared_decks").delete().eq("id", id);
    void load();
  }

  return (
    <div className="space-y-4">
      <div className="rounded-3xl bg-card p-5 shadow-card">
        <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) void upload(f); e.target.value = ""; }} />
        <Button onClick={() => fileRef.current?.click()}><Upload className="size-4" />上传 CSV 创建共享词库</Button>
        {msg && <p role="status" className="mt-3 text-sm text-muted-foreground">{msg}</p>}
      </div>
      {list.map((d) => (
        <div key={d.id} className="rounded-3xl bg-card p-5 shadow-card">
          <div className="flex items-center justify-between gap-3">
            <button className="text-left text-lg font-medium" onClick={() => setOpen(open === d.id ? null : d.id)}>{d.name}</button>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {assign.some((a) => a.shared_deck_id === d.id && a.user_id === null)
                  ? "下发给所有人"
                  : `下发给 ${assign.filter((a) => a.shared_deck_id === d.id).length} 人`}
              </span>
              <Button size="icon" variant="ghost" aria-label="删除共享词库" onClick={() => void remove(d.id)}><Trash2 className="size-4" /></Button>
            </div>
          </div>
          {open === d.id && (
            <SharedEditor deckId={d.id} profiles={profiles} assign={assign.filter((a) => a.shared_deck_id === d.id)} onChange={load} />
          )}
        </div>
      ))}
    </div>
  );
}

function SharedEditor({ deckId, profiles, assign, onChange }: { deckId: string; profiles: Profile[]; assign: Assign[]; onChange: () => void }) {
  const [cards, setCards] = useState<SharedCard[]>([]);
  const [draft, setDraft] = useState({ front: "", back: "", hint: "" });
  const load = useCallback(async () => {
    const { data } = await supabase.from("shared_cards").select("id,front,back,hint").eq("shared_deck_id", deckId).order("id");
    setCards(data ?? []);
  }, [deckId]);
  useEffect(() => void load(), [load]);

  const everyone = assign.some((a) => a.user_id === null);
  async function setEveryone(on: boolean) {
    if (on) await supabase.from("deck_assignments").insert({ shared_deck_id: deckId, user_id: null });
    else await supabase.from("deck_assignments").delete().eq("shared_deck_id", deckId).is("user_id", null);
    onChange();
  }
  async function setUser(uid: string, on: boolean) {
    if (on) await supabase.from("deck_assignments").insert({ shared_deck_id: deckId, user_id: uid });
    else await supabase.from("deck_assignments").delete().eq("shared_deck_id", deckId).eq("user_id", uid);
    onChange();
  }
  async function save(c: SharedCard) {
    await supabase.from("shared_cards").update({ front: c.front, back: c.back, hint: c.hint || null }).eq("id", c.id);
  }
  async function add() {
    if (!draft.front.trim() || !draft.back.trim()) return;
    await supabase.from("shared_cards").insert({ shared_deck_id: deckId, front: draft.front.trim(), back: draft.back.trim(), hint: draft.hint.trim() || null });
    setDraft({ front: "", back: "", hint: "" });
    void load();
  }
  async function del(id: string) {
    await supabase.from("shared_cards").delete().eq("id", id);
    void load();
  }
  const input = "h-9 w-full rounded-lg border border-input bg-background px-2 text-sm";

  return (
    <div className="mt-4 space-y-5">
      <div className="rounded-2xl bg-secondary/50 p-4">
        <h4 className="text-sm font-medium">下发给</h4>
        <label className="mt-3 flex items-center gap-3 text-sm"><Switch checked={everyone} onCheckedChange={(v) => void setEveryone(v)} />所有人（包括以后注册的）</label>
        {!everyone && (
          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {profiles.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={assign.some((a) => a.user_id === p.id)} onChange={(e) => void setUser(p.id, e.target.checked)} />
                {p.display_name || p.email}
              </label>
            ))}
          </div>
        )}
      </div>
      <div>
        <h4 className="text-sm font-medium">词语（{cards.length}）· 修改后点别处自动保存</h4>
        <div className="mt-2 space-y-2">
          {cards.map((c, i) => (
            <div key={c.id} className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
              {(["front", "back", "hint"] as const).map((k) => (
                <input key={k} className={input} value={c[k] ?? ""} placeholder={k === "hint" ? "提示（可选）" : ""}
                  onChange={(e) => setCards((cs) => cs.map((x, j) => (j === i ? { ...x, [k]: e.target.value } : x)))}
                  onBlur={() => void save(cards[i]!)} />
              ))}
              <Button size="icon" variant="ghost" aria-label="删除词语" onClick={() => void del(c.id)}><Trash2 className="size-4" /></Button>
            </div>
          ))}
          <div className="grid grid-cols-[1fr_1fr_1fr_auto] gap-2">
            <input className={input} placeholder="正面" value={draft.front} onChange={(e) => setDraft({ ...draft, front: e.target.value })} />
            <input className={input} placeholder="背面" value={draft.back} onChange={(e) => setDraft({ ...draft, back: e.target.value })} />
            <input className={input} placeholder="提示（可选）" value={draft.hint} onChange={(e) => setDraft({ ...draft, hint: e.target.value })} />
            <Button size="sm" onClick={() => void add()}>添加</Button>
          </div>
        </div>
      </div>
    </div>
  );
}
