import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { resolveConsent, useAutoSync, useSyncStatus } from "@/lib/sync";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

/** Mount once: runs background sync and asks before uploading this device's decks. */
export function SyncHost() {
  useAutoSync();
  const status = useSyncStatus();
  const [uid, setUid] = useState<string | null>(null);
  useEffect(() => {
    if (status.needsConsent) void supabase.auth.getSession().then(({ data }) => setUid(data.session?.user.id ?? null));
  }, [status.needsConsent]);

  return (
    <AlertDialog open={Boolean(status.needsConsent && uid)}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>把本机词库上传到账号？</AlertDialogTitle>
          <AlertDialogDescription>
            上传后，这些词库和学习进度会保存在账号里，换手机或电脑登录也能继续背。选「先不上传」则它们只留在这台设备上。
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={() => uid && resolveConsent(uid, false)}>先不上传</AlertDialogCancel>
          <AlertDialogAction onClick={() => uid && resolveConsent(uid, true)}>上传</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
