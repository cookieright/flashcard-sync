import { useState } from "react";
import { BellRing, Settings2 } from "lucide-react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { GOAL_OPTIONS, remindersSupported, useStudyPlan } from "@/lib/study-plan";

const CURVE = ["5 分钟", "30 分钟", "12 小时", "1 天", "2 天", "4 天", "7 天", "15 天", "30 天"];

export function StudySettings() {
  const { settings, update } = useStudyPlan();
  const [notice, setNotice] = useState<string | null>(null);
  const native = remindersSupported();

  async function toggleReminder(on: boolean) {
    setNotice(null);
    if (!on) return update({ reminderEnabled: false });
    const api = window.__flashwordsReminders;
    if (!api) return;
    const ok = await api.enable().catch(() => false);
    if (!ok) {
      setNotice("没有通知权限。请在手机「设置 → 应用 → 词卡 → 通知」里允许通知后再打开。");
      return;
    }
    update({ reminderEnabled: true });
  }

  return (
    <Sheet>
      <SheetTrigger
        className="flex size-10 shrink-0 items-center justify-center rounded-full bg-card text-muted-foreground shadow-card transition-colors hover:text-primary"
        aria-label="设置"
      >
        <Settings2 className="size-4" />
      </SheetTrigger>
      <SheetContent side="bottom" className="max-h-[92vh] overflow-y-auto rounded-t-3xl px-5 pb-10">
        <SheetHeader className="px-0 text-left">
          <SheetTitle className="text-xl">学习设置</SheetTitle>
          <SheetDescription>随时可以修改，立即生效。</SheetDescription>
        </SheetHeader>

        <section className="mt-2">
          <h3 className="text-sm font-medium">每日新词目标</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            每天学习多少个新词语。到期的复习词不受这个数量限制。
          </p>
          <div className="mt-3 grid grid-cols-5 gap-2" role="radiogroup" aria-label="每日新词目标">
            {GOAL_OPTIONS.map((n) => {
              const active = settings.dailyGoal === n;
              return (
                <button
                  key={n}
                  role="radio"
                  aria-checked={active}
                  onClick={() => update({ dailyGoal: n })}
                  className={`rounded-2xl py-3 text-sm font-medium transition-colors ${
                    active
                      ? "bg-primary text-primary-foreground shadow-card"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70"
                  }`}
                >
                  {n}
                </button>
              );
            })}
          </div>
        </section>

        <section className="mt-7">
          <h3 className="text-sm font-medium">滚动复习（艾宾浩斯遗忘曲线）</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            每次点「记住了」，下次复习往后推一档；点「还不熟」，从头开始。
          </p>
          <ol className="mt-3 flex flex-wrap items-center gap-1.5 text-xs">
            {CURVE.map((label, i) => (
              <li key={label} className="flex items-center gap-1.5">
                <span className="rounded-full bg-secondary px-2.5 py-1 text-secondary-foreground">
                  {label}
                </span>
                {i < CURVE.length - 1 && <span className="text-muted-foreground">→</span>}
              </li>
            ))}
          </ol>
        </section>

        <section className="mt-7 rounded-3xl bg-secondary/50 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <span className="flex size-9 items-center justify-center rounded-2xl bg-card text-primary">
                <BellRing className="size-4" />
              </span>
              <div>
                <h3 className="text-sm font-medium">每日提醒</h3>
                <p className="text-xs text-muted-foreground">按时推送今天要学、要复习的数量</p>
              </div>
            </div>
            <Switch
              checked={settings.reminderEnabled}
              disabled={!native}
              onCheckedChange={(v) => void toggleReminder(v)}
              aria-label="每日提醒"
            />
          </div>

          {native ? (
            <label className="mt-4 flex items-center justify-between gap-4 rounded-2xl bg-card px-4 py-3">
              <span className="text-sm">提醒时间</span>
              <input
                type="time"
                value={settings.reminderTime}
                onChange={(e) => e.target.value && update({ reminderTime: e.target.value })}
                className="rounded-xl bg-secondary px-3 py-1.5 text-base font-medium tabular-nums text-foreground"
              />
            </label>
          ) : (
            <p className="mt-3 text-xs text-muted-foreground">
              推送提醒需要在安卓 App 里使用，网页版不支持定时推送。
            </p>
          )}
          {notice && <p className="mt-3 text-xs text-destructive">{notice}</p>}
        </section>
      </SheetContent>
    </Sheet>
  );
}
