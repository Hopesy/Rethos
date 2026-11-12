import { t } from "@/lib/i18n";
import { useStore, type Bot } from "@/state/store";
import { useBotEditor } from "./BotEditorContext";
import { SettingsHelp } from "../SettingsHelp";

const sectionKey = (section?: string | null) => (section ?? "").trim();

/** The same reach server/peer-roster.ts grants a Chief for proposals. */
function chiefCovers(bot: Bot, bots: ReadonlyArray<Bot>): boolean {
  const target = sectionKey(bot.section);
  return bots.some((candidate) =>
    candidate.id !== bot.id &&
    Boolean(candidate.chiefOfStaff) &&
    (sectionKey(candidate.section) === target ||
      (Array.isArray(candidate.managedSections) &&
        candidate.managedSections.some((team) => typeof team === "string" && sectionKey(team) === target))));
}

export function ProposalStatus({ bot, kind }: { bot: Bot; kind: "chief" | "owner" }) {
  const { draft } = useBotEditor();
  const { state } = useStore();
  if (draft || !chiefCovers(bot, state.bots)) return null;
  return (
    <div className="mt-1 flex items-center gap-1 text-[11px] text-ink-secondary">
      <span className="rounded bg-control/60 px-1.5 py-0.5">{t(kind === "chief" ? "botSettings.proposal.chiefShort" : "botSettings.proposal.ownerShort")}</span>
      <SettingsHelp label={t(kind === "chief" ? "botSettings.proposal.chiefShort" : "botSettings.proposal.ownerShort")}>
        {t(kind === "chief" ? "botSettings.proposal.chief" : "botSettings.proposal.owner")}
      </SettingsHelp>
    </div>
  );
}
