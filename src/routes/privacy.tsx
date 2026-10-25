import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

const CONTACT_EMAIL = "bessiecui0608@gmail.com";
const UPDATED = "2026 年 10 月 25 日";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "隐私说明 — 乖乖背词语" },
      { name: "description", content: "词卡 App 收集哪些数据、存在哪里、如何查看和删除。" },
      { property: "og:title", content: "隐私说明 — 乖乖背词语" },
      { property: "og:type", content: "website" },
    ],
  }),
  component: PrivacyPage,
});

export function PrivacyPage() {
  return (
    <main className="mx-auto min-h-screen max-w-2xl px-5 pb-20 pt-[max(1.5rem,env(safe-area-inset-top))]">
      <Link to="/" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4" /> 返回词库
      </Link>
      <h1 className="mt-4 text-3xl">隐私说明</h1>
      <p className="mt-1 text-sm text-muted-foreground">最后更新：{UPDATED}</p>

      <div className="mt-6 rounded-3xl bg-card p-5 text-sm leading-relaxed shadow-card">
        <p className="font-medium">简单来说</p>
        <ul className="mt-2 list-disc space-y-1 pl-5 text-muted-foreground">
          <li>不登录时，你的词库和学习记录只保存在你自己的设备上。</li>
          <li>登录后，词库和学习进度会保存到云端，用于多设备同步。</li>
          <li>管理员（家长/老师）可以看到账号的学习数据，用来了解学习情况和下发词库。</li>
          <li>没有广告，不出售数据，不做用户画像。</li>
          <li>你可以随时要求查看、导出或删除你的数据。</li>
        </ul>
      </div>

      <Section title="1. 谁负责你的数据">
        <p>
          「乖乖背词语 / 词卡」由个人开发者运营，供家人和学生学习使用。关于个人数据的任何问题，请发邮件到{" "}
          <a className="text-primary underline" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          。
        </p>
      </Section>

      <Section title="2. 我们收集哪些数据">
        <p className="font-medium text-foreground">不登录时</p>
        <p>
          导入的词库、学习进度、每日学习记录和设置，全部只保存在你设备的本地存储中，不会上传。卸载 App 或清除浏览器数据会一并删除这些内容。
        </p>
        <p className="font-medium text-foreground">登录账号后</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>账号信息：邮箱、密码（加密保存，任何人都无法看到原文）、显示名称、注册时间、最后活跃时间。</li>
          <li>学习内容：你导入的词库名称和词语（正面、背面、例句）。</li>
          <li>学习进度：每个词的复习阶段、下次复习时间、复习和遗忘次数。</li>
          <li>每日记录：每天学习的新词数和复习次数。</li>
          <li>学习设置：每日目标、是否开启提醒、提醒时间。</li>
        </ul>
        <p>我们不收集你的位置、通讯录、照片或设备标识，也不使用任何统计分析或广告追踪工具。</p>
      </Section>

      <Section title="3. 为什么要用这些数据">
        <ul className="list-disc space-y-1 pl-5">
          <li>为你提供账号、云端备份和多设备同步（为履行你注册使用的服务）。</li>
          <li>让管理员查看学习情况、下发词库、在必要时停用账号（基于家庭/教学中的正当利益）。</li>
          <li>按艾宾浩斯遗忘曲线安排复习、推送每日提醒。</li>
        </ul>
      </Section>

      <Section title="4. 谁能看到你的数据">
        <ul className="list-disc space-y-1 pl-5">
          <li>你自己。</li>
          <li>
            管理员：可以看到你的名字、邮箱、学习统计（每日数量、连续天数、掌握率、最常忘的词）和词库进度。
          </li>
          <li>
            数据托管服务商：云端数据存放在 Lovable Cloud（基于 Supabase）的服务器上，它们仅为存储和运行服务处理数据。
          </li>
          <li>
            发音服务：点「播放读音」或开启自动朗读时，当前词语的文字会发送给 Google 翻译的语音服务以获取读音（同时会传送你的 IP 地址），无法连接时改用手机自带的语音引擎在本机朗读。
          </li>
          <li>页面字体从 Google Fonts 加载，加载时你的 IP 地址会传送给 Google。</li>
        </ul>
        <p>除上述情况和法律要求外，我们不会把你的数据提供给任何人。</p>
      </Section>

      <Section title="5. 每日提醒">
        <p>
          提醒通知由手机系统在本机定时发出，提醒内容（今天要复习、要学习的数量）在你的设备上计算，不经过任何推送服务器。你可以在设置里随时关闭或修改时间。
        </p>
      </Section>

      <Section title="6. 保存多久">
        <p>
          云端数据在你的账号存在期间一直保存。删除账号后，账号及其全部词库、进度和记录会立即从数据库中删除。设备上的本地数据由你自己控制。
        </p>
      </Section>

      <Section title="7. 你的权利">
        <p>根据欧盟《通用数据保护条例》（GDPR），你有权：</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>查看我们保存的你的数据，并获得一份可导出的副本；</li>
          <li>更正不准确的数据；</li>
          <li>删除你的账号和全部数据；</li>
          <li>反对或限制某些处理，例如不让管理员查看你的学习数据；</li>
          <li>
            向数据保护机构投诉。在意大利是 Garante per la protezione dei dati personali（garanteprivacy.it）。
          </li>
        </ul>
        <p>
          删除账号：在「账号与同步」页面点「删除账号」，账号和云端全部数据会立即永久删除，本机词库保留。其他权利请从注册邮箱发邮件到 {CONTACT_EMAIL}，我们会在 30 天内处理。如果你只是想停止同步，退出登录即可。
        </p>
      </Section>

      <Section title="8. 未成年人">
        <p>
          未满 14 岁的用户需由父母或监护人同意后才能注册账号；不登录则无需提供任何个人信息即可使用全部学习功能。家长可随时联系我们查看或删除孩子的数据。
        </p>
      </Section>

      <Section title="9. 安全">
        <p>
          数据传输全程加密（HTTPS），数据库按账号隔离，每个用户只能读写自己的数据；只有管理员账号可以查看学习统计。
        </p>
      </Section>

      <Section title="10. 说明的更新">
        <p>如果这份说明有重要变化，我们会在 App 中提示，并更新页面顶部的日期。</p>
      </Section>
    </main>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-medium">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-muted-foreground">{children}</div>
    </section>
  );
}
