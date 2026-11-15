import { useState } from "react";
import { workTargetKey, type WorkTarget } from "../../shared/work-target";
import type { Bot } from "@/state/store";
import { targetLabel, useWorkTarget } from "@/lib/work-target";
import { t } from "@/lib/i18n";
import { Select } from "./Select";
import { SettingsHelp } from "./SettingsHelp";
import { LocalComputerAutoWarning } from "./LocalComputerAutoWarning";
import { approvalModeFor, threadApproval } from "../../shared/approval-mode";

export function WorkTargetPicker({ bot, thread = false }: { bot: Bot; thread?: boolean }) {
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
  return <section className="rounded-xl bg-card p-4" data-testid="work-target-picker">
    <div className="flex items-center gap-1 text-[14px] font-medium text-ink">
      {t(thread ? "workTarget.conversation" : "computer.simple.whereWorks", { name: bot.name })}
      <SettingsHelp label={t("computer.worksOn")}>{t("workTarget.help")}</SettingsHelp>
      <Select aria-label={t(thread ? "workTarget.conversation" : "computer.simple.whereWorks", { name: bot.name })}
        className="ml-auto min-w-0 max-w-[60%]" value={value} disabled={!status || saving}
        onChange={event => { const next = options.find(option => choiceKey(option.target) === event.target.value); if (event.target.value === "follow") void save(null); else if (next) choose(next.target); }}>
        {thread && <option value="follow">{t("place.followBot")} · {targetLabel(status?.defaultTarget ?? selected, status)}</option>}
        {!options.some(option => choiceKey(option.target) === choiceKey(selected)) && value !== "follow" && <option value={value}>{targetLabel(selected, status)}</option>}
        {options.map(option => <option key={choiceKey(option.target)} value={choiceKey(option.target)} disabled={!option.available}>
          {targetLabel(option.target, status)}{!option.ready ? ` · ${t(option.state === "paused" ? "workTarget.paused" : option.state === "revoked" ? "computer.connected.unshared" : "computer.connected.offline")}` : ""}
        </option>)}
      </Select>
    </div>
    <p className="mt-2 break-words text-[12px] text-ink-secondary" role="status">{t("workTarget.selected", { name: targetLabel(selected, status) })}</p>
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
