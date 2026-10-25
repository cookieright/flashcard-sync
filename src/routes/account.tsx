import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ArrowLeft, Cloud, RefreshCw } from "lucide-react";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { syncNow, useSyncStatus } from "@/lib/sync";

export const Route = createFileRoute("/account")({
  head: () => ({
    meta: [
      { title: "账号与同步 — 乖乖背词语" },
      { name: "description", content: "登录账号，把词库和学习进度同步到所有设备。" },
      { property: "og:title", content: "账号与同步 — 乖乖背词语" },
      { property: "og:description", content: "登录后自动云同步词库与复习进度。" },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AccountPage,
});

function fmt(ts?: number) {
  return ts ? new Date(ts).toLocaleString("zh-CN", { hour12: false }) : "还没有同步过";
}

export function AccountPage() {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const status = useSyncStatus();

  useEffect(() => {
    void supabase.auth
      .getSession()
      .then(({ data }) => setUser(data.session?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setReady(true));
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user ?? null));
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (!user) return setIsAdmin(false);
    void supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }).then(({ data }) => setIsAdmin(Boolean(data)));
  }, [user]);

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 pb-16 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> 返回词库
      </Link>
      <h1 className="mt-4 text-3xl">账号与同步</h1>
      <p className="mt-1 text-sm text-muted-foreground">不登录也能正常使用；登录后词库和进度会自动同步到其他设备。</p>

      {!ready ? null : user ? (
        <section className="mt-6 space-y-4">
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <p className="text-xs text-muted-foreground">当前账号</p>
            <p className="mt-1 break-all font-medium">{user.email}</p>
          </div>
          <div className="rounded-3xl bg-card p-5 shadow-card">
            <div className="flex items-center gap-2">
              <Cloud className="size-4 text-primary" />
              <h2 className="text-sm font-medium">同步状态</h2>
            </div>
            <p className="mt-2 text-sm">上次同步：{fmt(status.lastSync)}</p>
            {status.error && <p role="alert" className="mt-2 text-sm text-destructive">{status.error}</p>}
            <Button className="mt-4 w-full" disabled={status.syncing} onClick={() => void syncNow()}>
              <RefreshCw className={`size-4 ${status.syncing ? "animate-spin" : ""}`} />
              {status.syncing ? "同步中…" : "立即同步"}
            </Button>
          </div>
          {isAdmin && (
            <Button asChild variant="outline" className="w-full">
              <a href="/admin">打开管理后台</a>
            </Button>
          )}
          <Button variant="ghost" className="w-full" onClick={() => void supabase.auth.signOut()}>
            退出登录
          </Button>
          <p className="text-xs text-muted-foreground">退出后，本机词库仍然保留，可以继续离线学习。</p>
        </section>
      ) : (
        <AuthForm />
      )}
      <p className="mt-10 text-center text-xs text-muted-foreground">
        登录即表示你已阅读{" "}
        <Link to="/privacy" className="underline hover:text-primary">
          隐私说明
        </Link>
        ，了解数据如何保存和删除。
      </p>
    </main>
  );
}

function AuthForm() {
  const [signup, setSignup] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setNotice("");
    try {
      if (signup) {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${siteOrigin()}/account`,
            data: name ? { display_name: name } : {},
          },
        });
        if (error) throw error;
        if (!data.session) setNotice("注册成功！请到邮箱点击确认链接，然后回来登录。");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "";
      setNotice(/invalid login/i.test(msg) ? "邮箱或密码不对。" : msg || "失败了，请重试。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 flex flex-col gap-4 rounded-3xl bg-card p-5 shadow-card">
      <h2 className="text-lg font-medium">{signup ? "注册新账号" : "登录"}</h2>
      {signup && (
        <label className="text-sm">
          名字（家人/老师看到的称呼）
          <input value={name} onChange={(e) => setName(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3" />
        </label>
      )}
      <label className="text-sm">
        邮箱
        <input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3" />
      </label>
      <label className="text-sm">
        密码
        <input type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-xl border border-input bg-background px-3" />
      </label>
      <Button type="submit" disabled={busy}>{busy ? "请稍候…" : signup ? "注册" : "登录"}</Button>
      {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
      <Button type="button" variant="link" onClick={() => { setSignup(!signup); setNotice(""); }}>
        {signup ? "已有账号？去登录" : "没有账号？注册一个"}
      </Button>
    </form>
  );
}

/** Inside the Android app the page origin is https://localhost, which email links can't open. */
function siteOrigin() {
  const native = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor?.isNativePlatform?.();
  return native ? "https://flashcard-sync.lovable.app" : window.location.origin;
}
