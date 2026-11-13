import { t } from "@/lib/i18n";
import type { Bot } from "@/state/store";
import { hasDefaultBotCapabilities } from "../../../shared/default-bot-capabilities";

export function MemoryEnabledControl({ bot, onToggle }: { bot: Bot; onToggle: (enabled: boolean) => void }) {
  if (hasDefaultBotCapabilities(bot)) return <p role="status" className="text-[13px] text-ink-secondary">{t("memory.defaultAlwaysOn")}</p>;
  return <>
    <label className="flex items-center gap-2 text-[13px] text-ink">
      <input type="checkbox" checked={bot.memoryEnabled !== false} disabled={bot.busy} onChange={event => onToggle(event.target.checked)} />
      {t("memory.enable")}
    </label>
    <p className="mt-1 text-[13px] text-ink-secondary">
      {t("memory.enableHelp")}{bot.busy ? ` ${t("memory.busyHelp")}` : ""}
    </p>
  </>;
}
