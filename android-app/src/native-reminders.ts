// Daily study reminders inside the Android app (local notifications, no server needed).
// The plan itself (times + text) comes from src/lib/study-plan.ts.
import { Capacitor } from "@capacitor/core";
import { LocalNotifications } from "@capacitor/local-notifications";
import type { PlannedReminder } from "@/lib/study-plan";

const CHANNEL = "study-reminders";

async function exactAllowed() {
  try {
    return (await LocalNotifications.checkExactNotificationSetting()).exact_alarm === "granted";
  } catch {
    return true;
  }
}

export function installNativeReminders() {
  if (!Capacitor.isNativePlatform()) return;

  void LocalNotifications.createChannel({
    id: CHANNEL,
    name: "学习提醒",
    description: "每日学习和复习提醒",
    importance: 4,
    visibility: 1,
  }).catch(() => {});

  window.__flashwordsReminders = {
    async enable() {
      let perm = await LocalNotifications.checkPermissions();
      if (perm.display !== "granted") perm = await LocalNotifications.requestPermissions();
      if (perm.display !== "granted") return false;
      // Ask once for "Alarms & reminders" so the reminder arrives on time (optional).
      if (!(await exactAllowed())) {
        await LocalNotifications.changeExactNotificationSetting().catch(() => {});
      }
      return true;
    },

    async schedule(list: PlannedReminder[]) {
      const pending = await LocalNotifications.getPending();
      if (pending.notifications.length > 0) {
        await LocalNotifications.cancel({
          notifications: pending.notifications.map((n) => ({ id: n.id })),
        });
      }
      if (list.length === 0) return;
      if ((await LocalNotifications.checkPermissions()).display !== "granted") return;
      const exact = await exactAllowed();
      await LocalNotifications.schedule({
        notifications: list.map((r) => ({
          id: r.id,
          title: r.title,
          body: r.body,
          channelId: CHANNEL,
          smallIcon: "ic_stat_notify",
          schedule: { at: new Date(r.at), allowWhileIdle: true },
          // Never pop the settings screen during background re-planning.
          isExactNotification: exact,
        })),
      });
    },
  };
}
