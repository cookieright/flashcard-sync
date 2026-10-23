import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/.lovable/oauth/consent")({
  ssr: false,
  validateSearch: (s: Record<string, unknown>) => ({ authorization_id: typeof s.authorization_id === "string" ? s.authorization_id : "" }),
  head: () => ({ meta: [
    { title: "授权助手连接 — Word Flash Companion" },
    { name: "description", content: "确认助手的身份和权限，批准或取消连接。" },
    { property: "og:title", content: "授权助手连接 — Word Flash Companion" },
    { property: "og:description", content: "由你决定是否授权助手使用词卡工具。" },
    { property: "og:type", content: "website" },
    { name: "twitter:card", content: "summary" },
  ] }),
  beforeLoad: async ({ search, location }) => {
    if (!search.authorization_id) throw new Error("授权请求缺少编号，请从助手重新发起连接。");
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    if (!data.session) throw redirect({ to: "/login", search: { next: location.pathname + location.searchStr + location.hash } });
    return { account: data.session.user.email ?? "当前账号" };
  },
  loader: async ({ location }) => {
    const id = new URLSearchParams(location.searchStr).get("authorization_id");
    if (!id) throw new Error("授权请求无效。");
    const { data, error } = await supabase.auth.oauth.getAuthorizationDetails(id);
    if (error) throw error;
    if (data && "redirect_url" in data && data.redirect_url) throw redirect({ href: data.redirect_url });
    if (!data || !("client" in data)) throw new Error("授权请求已过期或无效，请重新连接。");
    return data;
  },
  errorComponent: ({ error }) => <main className="mx-auto max-w-md px-6 py-16"><h1 className="text-2xl">无法加载授权请求</h1><p role="alert" className="mt-4 text-sm text-muted-foreground">{error.message}</p><Button asChild className="mt-6"><a href="/">回到词库</a></Button></main>,
  component: Consent,
});

function Consent() {
  const details = Route.useLoaderData();
  const { account } = Route.useRouteContext();
  const { authorization_id } = Route.useSearch();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  async function decide(approve: boolean) {
    setBusy(true); setError("");
    try {
      const result = approve ? await supabase.auth.oauth.approveAuthorization(authorization_id) : await supabase.auth.oauth.denyAuthorization(authorization_id);
      if (result.error) throw result.error;
      if (!result.data?.redirect_url) throw new Error("未收到返回地址，请重新发起连接。");
      window.location.assign(result.data.redirect_url);
    } catch (failure) { setError(failure instanceof Error ? failure.message : "授权失败，请重试。"); setBusy(false); }
  }
  const scopeLabels: Record<string, string> = { openid: "确认你的身份", email: "分享你的邮箱地址", profile: "分享基本个人资料" };
  return <main className="mx-auto flex min-h-screen max-w-lg flex-col justify-center gap-5 px-6 py-10">
    <h1 className="text-2xl">连接 {details.client.name} 至 Word Flash Companion</h1>
    <p className="text-sm text-muted-foreground">当前账号：{account}</p>
    <p className="break-all text-sm text-muted-foreground">返回地址：{details.redirect_uri}</p>
    <p className="text-sm">此助手可使用你主动提交的 CSV 解析词卡；不会读取浏览器中的个人词库或复习记录。</p>
    <ul className="list-inside list-disc text-sm">{details.scope.split(/\s+/).filter(Boolean).map((scope) => <li key={scope}>{scopeLabels[scope] ?? `额外请求权限：${scope}`}</li>)}</ul>
    <p className="text-sm text-muted-foreground">连接不会绕过此应用的权限限制。</p>
    {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
    <div className="flex gap-3"><Button disabled={busy} onClick={() => decide(true)}>允许连接</Button><Button variant="outline" disabled={busy} onClick={() => decide(false)}>取消连接</Button></div>
  </main>;
}