import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { Button } from "@/components/ui/button";
import { oauthReturnPath } from "@/lib/oauth-return-path";
import "@lovable.dev/cloud-auth-js/styles.css";

export const Route = createFileRoute("/login")({
  validateSearch: (s: Record<string, unknown>) => ({ next: oauthReturnPath(s['next']) }),
  head: () => ({ meta: [
    { title: "助手连接登录 — FLASHCARDS" },
    { name: "description", content: "登录以授权助手连接 Word Flash Companion。" },
    { property: "og:title", content: "助手连接登录 — FLASHCARDS" },
    { property: "og:description", content: "安全登录并返回助手授权页面。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  component: Login,
});

function Login() {
  const { next } = Route.useSearch();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signup, setSignup] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState("");
  useEffect(() => {
    void supabase.auth.getSession().then(({ data }) => {
      if (data.session) window.location.assign(next);
    });
  }, [next]);

  async function passwordLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true); setNotice("");
    try {
      const result = signup
        ? await supabase.auth.signUp({ email, password, options: { emailRedirectTo: new URL(next, window.location.origin).href } })
        : await supabase.auth.signInWithPassword({ email, password });
      if (result.error) throw result.error;
      if (result.data.session) window.location.assign(next);
      else setNotice("请查看邮箱，点击确认链接后继续授权。");
    } catch (error) { setNotice(error instanceof Error ? error.message : "登录失败，请重试。"); }
    finally { setBusy(false); }
  }

  async function socialLogin(provider: "google" | "lovable") {
    setBusy(true); setNotice("");
    try {
      const callback = new URL("/login", window.location.origin);
      callback.searchParams.set("next", next);
      const result = await lovable.auth.signInWithOAuth(provider, { redirect_uri: callback.href });
      if (result.error) throw result.error;
      if (!result.redirected) {
        const { data } = await supabase.auth.getSession();
        if (!data.session) throw new Error("登录尚未完成，请重试。");
        window.location.assign(next);
      }
    } catch (error) { setNotice(error instanceof Error ? error.message : "登录失败，请重试。"); setBusy(false); }
  }

  return <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-5 px-6 py-10">
    <h1 className="text-2xl">{signup ? "创建账号" : "登录"} · FLASHCARDS</h1>
    <form onSubmit={passwordLogin} className="flex flex-col gap-4">
      <label className="text-sm">邮箱<input type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-card px-3" /></label>
      <label className="text-sm">密码<input type="password" required minLength={6} autoComplete={signup ? "new-password" : "current-password"} value={password} onChange={(e) => setPassword(e.target.value)} className="mt-2 h-11 w-full rounded-md border border-input bg-card px-3" /></label>
      <Button disabled={busy} type="submit">{busy ? "请稍候…" : signup ? "注册" : "登录"}</Button>
    </form>
    {notice && <p role="status" className="text-sm text-muted-foreground">{notice}</p>}
    <Button variant="outline" disabled={busy} onClick={() => socialLogin("google")}>使用 Google 继续</Button>
    <Button className="lovable-auth-button" disabled={busy} onClick={() => socialLogin("lovable")}>Continue with Lovable</Button>
    <Button variant="link" disabled={busy} onClick={() => { setSignup(!signup); setNotice(""); }}>{signup ? "已有账号？登录" : "没有账号？注册"}</Button>
  </main>;
}