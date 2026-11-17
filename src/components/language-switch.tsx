import { useEffect } from "react";
import { Languages } from "lucide-react";
import { Button } from "@/components/ui/button";
import { restoreLanguage, setLanguage, useLanguage } from "@/lib/language";

export function LanguageSwitch() {
  const language = useLanguage();
  useEffect(() => {
    restoreLanguage();
  }, []);
  return (
    <nav
      aria-label="中文 / Italiano"
      className="mx-auto flex w-full max-w-5xl justify-end px-5 pt-[max(0.75rem,env(safe-area-inset-top))]"
    >
      <div className="flex items-center gap-1 rounded-md border border-border bg-card p-1">
        <Languages aria-hidden="true" className="mx-1 size-4 text-muted-foreground" />
        <Button
          size="sm"
          variant={language === "zh" ? "secondary" : "ghost"}
          aria-pressed={language === "zh"}
          onClick={() => setLanguage("zh")}
        >
          中文
        </Button>
        <Button
          size="sm"
          variant={language === "it" ? "secondary" : "ghost"}
          aria-pressed={language === "it"}
          onClick={() => setLanguage("it")}
        >
          Italiano
        </Button>
      </div>
    </nav>
  );
}
