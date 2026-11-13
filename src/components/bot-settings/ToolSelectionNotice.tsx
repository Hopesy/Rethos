import { t } from "@/lib/i18n";
import { useStore, type Bot } from "@/state/store";
import { hasDefaultBotCapabilities } from "../../../shared/default-bot-capabilities";
import { openBotSettings } from "../bot-panel/panel-link";
import { useToolSelectionEditor } from "./tool-selection-editor";

export function ToolSelectionNotice({ bot }: { bot: Bot }) {
  const { dispatch } = useStore();
  const { draft, saving, error } = useToolSelectionEditor(bot);
  if (hasDefaultBotCapabilities(bot) || (!draft && !saving && !error)) return null;
  return <div className="mx-4 my-2 flex shrink-0 items-center justify-between gap-3 rounded-lg bg-control px-3 py-2 text-[12px]">
    <span role={error ? "alert" : "status"} className={error ? "text-danger" : "text-ink-secondary"}>
      {error ? t("botAccess.tools.failed", { error }) : t(saving ? "botAccess.tools.saving" : "botAccess.tools.unsaved")}
    </span>
    <button type="button" className="shrink-0 text-accent hover:underline" onClick={() => openBotSettings(dispatch, "access", { botId: bot.id, page: "tools" })}>
      {t("botAccess.tools.title")}
    </button>
  </div>;
}
