import { useState } from "react";
import { Box, Check, Cloud, CornerDownRight, Globe, Monitor, Power, Sparkles, type LucideIcon } from "lucide-react";
import { workTargetKey, workTargetLegacyFields, type WorkTarget } from "../../shared/work-target";
import type { Bot } from "@/state/store";
import { targetLabel, useWorkTarget } from "@/lib/work-target";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { useAdvancedMode } from "@/lib/interface-mode";
import { worksOnSimpleLabel } from "@/lib/place-view";
import { useDesktopCapabilities } from "./DesktopCapabilities";
import { SettingsHelp } from "./SettingsHelp";
import { LocalComputerAutoWarning } from "./LocalComputerAutoWarning";
import { approvalModeFor, threadApproval } from "../../shared/approval-mode";

function targetAppearance(target: WorkTarget) {
  if (target.kind === "connected") return { Icon: Monitor, hint: "computer.connected.title" } as const;
  if (target.kind === "private") return target.backend === "vps"
    ? { Icon: Cloud, hint: "computer.dest.cloudDesc" } as const
    : { Icon: Box, hint: "computer.dest.vmDesc" } as const;
  return ({
    auto: { Icon: Sparkles, hint: "computer.dest.autoDesc" },
    local: { Icon: Monitor, hint: "computer.dest.localDesc" },
    browser: { Icon: Globe, hint: "computer.dest.browserDesc" },
    off: { Icon: Power, hint: "computer.dest.offDesc" },
  } as const)[target.kind];
}

function TargetCard({ value, label, description, issue, title, Icon, selected, disabled, advanced, onClick }: {
  value: string; label: string; description: string; issue?: string; title?: string; Icon: LucideIcon;
  selected: boolean; disabled: boolean; advanced: boolean; onClick: () => void;
}) {
  return <button type="button" data-work-target={value} aria-label={label} aria-pressed={selected}
    disabled={disabled} title={title ?? issue ?? description} onClick={onClick}
    className={cn(
      "min-w-0 rounded-lg border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-card",
      advanced ? "px-2.5 py-3 text-left" : "flex flex-col items-center gap-1.5 px-1.5 py-2.5 text-center",
      selected ? "border-accent/60 bg-accent/10 text-ink" : "border-hairline/50 bg-panel/30 text-ink-secondary",
      disabled ? cn("cursor-not-allowed", !advanced && "opacity-50") : "hover:border-accent/40 hover:bg-control/60",
    )}>
    {advanced ? <>
      <span className="flex items-center gap-2 text-[12px] font-medium leading-4">
        {selected ? <Check size={14} className="shrink-0 text-accent" aria-hidden="true" /> : <Icon size={14} className="shrink-0 text-ink-secondary" aria-hidden="true" />}
        <span className="min-w-0 break-words">{label}</span>
      </span>
      <span className="mt-1.5 block text-[11px] leading-4 text-ink-secondary">{issue ?? description}</span>
    </> : <>
      <Icon size={16} className={cn("shrink-0", selected ? "text-accent" : "text-ink-secondary")} aria-hidden="true" />
      <span className="w-full truncate text-[12px] font-medium leading-4">{label}</span>
      {issue && <span className="w-full truncate text-[11px] leading-3 text-ink-secondary">{issue}</span>}
    </>}
  </button>;
}

export function WorkTargetPicker({ bot, thread = false }: { bot: Bot; thread?: boolean }) {
  const advanced = useAdvancedMode();
  const { capabilities } = useDesktopCapabilities();
  const { status, selected, saving, error, save } = useWorkTarget(bot, thread);
  const [draft, setDraft] = useState<{ key: string; value: string } | null>(null);
  const [confirmLocal, setConfirmLocal] = useState(false);
  const task = thread ? bot.tasks?.find(item => item.threadId === bot.threadId) : undefined;
  const choose = (target: WorkTarget) => {
    if (target.kind === "local" && approvalModeFor(task ? threadApproval(task, bot) : bot) === "auto") setConfirmLocal(true);
    else void save(target);
  };
  const key = `${bot.id}:${thread ? bot.threadId : "default"}:${workTargetKey(selected)}`;
  const choiceKey = (target: WorkTarget) => workTargetKey(target.kind === "connected" ? { kind: "connected", computerId: target.computerId } : target);
  const value = thread && !status?.pinnedTarget ? "follow" : choiceKey(selected);
  const options = status?.options ?? [];
  const choices = options.some(option => choiceKey(option.target) === choiceKey(selected)) || value === "follow"
    ? options : [{ target: selected, label: targetLabel(selected, status), available: false, ready: false }, ...options];
  const label = t(thread ? "workTarget.conversation" : "computer.simple.whereWorks", { name: bot.name });
  return <section className="rounded-xl bg-card p-4" data-testid="work-target-picker">
    <div className="flex items-center gap-1 text-[15px] font-medium text-ink">
      {label}
      <SettingsHelp label={t("computer.worksOn")}>{t("workTarget.help")}</SettingsHelp>
    </div>
    <div role="group" aria-label={label} aria-busy={saving} className={cn("mt-3 grid gap-2", advanced ? "auto-rows-fr grid-cols-2" : "grid-cols-3")}>
      {thread && <TargetCard value="follow" label={t("place.followBot")} selected={value === "follow"}
        description={t("place.followBotDetail", { place: targetLabel(status?.defaultTarget ?? selected, status) })}
        Icon={CornerDownRight} advanced={advanced} disabled={!status || saving} onClick={() => { if (value !== "follow") void save(null); }} />}
      {choices.map(option => {
        const optionKey = choiceKey(option.target), checked = value === optionKey;
        const { Icon, hint } = targetAppearance(option.target);
        const state = option.target.kind === "connected"
          ? t(option.state === "paused" ? "workTarget.paused" : option.state === "revoked" ? "computer.connected.unshared" : option.ready ? "computer.connected.online" : "computer.connected.offline") : undefined;
        const issue = state && (!option.ready || option.state === "paused" || option.state === "revoked") ? state
          : !option.available ? t("place.view.ccUnavailable.short") : !option.ready ? t("vm.main.notReady") : undefined;
        return <TargetCard key={optionKey} value={optionKey} selected={checked} Icon={Icon} advanced={advanced}
          label={advanced || option.target.kind === "connected" ? targetLabel(option.target, status) : worksOnSimpleLabel(workTargetLegacyFields(option.target).computer, capabilities.host.platform)}
          description={state ?? t(hint)} issue={issue} title={option.reason}
          disabled={!status || saving || !option.available} onClick={() => { if (!checked) choose(option.target); }} />;
      })}
    </div>
    <p className={cn("mt-3 break-words text-[12px] leading-5 text-ink-secondary", advanced && "border-t border-hairline/40 pt-3")} role="status">{t("workTarget.selected", { name: targetLabel(selected, status) })}</p>
    {selected.kind === "connected" && <form className="mt-3 flex gap-2" onSubmit={async event => {
      event.preventDefault();
      const value = (draft?.key === key ? draft.value : selected.cwd ?? "").trim();
      if (await save({ kind: "connected", computerId: selected.computerId, ...(value ? { cwd: value } : {}) })) setDraft(current => current?.key === key && current.value.trim() === value ? null : current);
    }}>
      <input className="min-w-0 flex-1 rounded-lg bg-inset px-3 py-2 text-[13px]" aria-label={t("workTarget.folder")} placeholder={t("workTarget.folder")}
        value={draft?.key === key ? draft.value : selected.cwd ?? ""} onChange={event => setDraft({ key, value: event.target.value })} />
      <button type="submit" disabled={saving || draft?.key !== key} className="rounded-lg bg-control px-3 py-2 text-[13px] disabled:opacity-50">{t("botAccess.folder.save")}</button>
    </form>}
    {error && <p role="alert" className="mt-2 break-words text-[12px] text-danger">{error}</p>}
    <LocalComputerAutoWarning open={confirmLocal} onCancel={() => setConfirmLocal(false)} onConfirm={() => { setConfirmLocal(false); void save({ kind: "local" }, true); }} />
  </section>;
}
