import { useEffect, useState } from "react";
import { Monitor, RefreshCw } from "lucide-react";
import { resolveWorkTarget } from "../../shared/work-target";
import { approvalModeFor, threadApproval } from "../../shared/approval-mode";
import type { ConnectedComputersStatus, SharedComputerStatus } from "../../shared/connected-computers";
import { t } from "@/lib/i18n";
import { api, ApiError } from "@/state/api";
import type { Bot } from "@/state/store";
import { SettingsHelp } from "./SettingsHelp";

export function ConnectedComputers({ bot, manage = false }: { bot?: Bot; manage?: boolean }) {
  const [status, setStatus] = useState<ConnectedComputersStatus | null>(null);
  const [error, setError] = useState(false);
  const [retry, setRetry] = useState(0);
  const [busy, setBusy] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const changeAccess = async (id: string, mode: "enabled" | "paused" | "revoked") => {
    setBusy(id); setActionError(null);
    try {
      await api(`/api/shared-computers/${id}/access`, { method: "PATCH", body: JSON.stringify({ mode }) });
      setRetry(value => value + 1);
    } catch (error) { setActionError(String((error as Error).message)); }
    finally { setBusy(null); }
  };
  const actions = (computer: { id: string; access?: string }) => manage && <div className="mt-2 flex gap-2">
    {computer.access !== "revoked" && <>
      <button type="button" disabled={busy !== null} onClick={() => void changeAccess(computer.id, computer.access === "paused" ? "enabled" : "paused")} className="rounded bg-control px-2 py-1 text-[12px] disabled:opacity-50">{t(computer.access === "paused" ? "computerSharing.resume" : "computerSharing.pause")}</button>
      <button type="button" disabled={busy !== null} onClick={() => void changeAccess(computer.id, "revoked")} className="rounded bg-control px-2 py-1 text-[12px] text-danger disabled:opacity-50">{t("computerSharing.stop")}</button>
    </>}
    {computer.access === "revoked" && <p className="text-[12px] text-ink-secondary">{t("workTarget.reconnect")}</p>}
  </div>;
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const refresh = async () => {
      let supported = true;
      try {
        const next = await api<ConnectedComputersStatus>("/api/shared-computers", { signal: controller.signal, timeoutMs: 10_000, background: true });
        if (controller.signal.aborted) return;
        setStatus(next); setError(false);
      } catch (failure) {
        if (controller.signal.aborted) return;
        supported = !(failure instanceof ApiError && failure.status === 404);
        setStatus(null); setError(supported);
      }
      if (supported && !controller.signal.aborted) timer = setTimeout(() => void refresh(), 10_000);
    };
    void refresh();
    return () => { controller.abort(); clearTimeout(timer); };
  }, [retry]);

  const computers = status?.computers ?? [];
  const offline = (status?.known ?? []).filter(computer => !computers.some(current => current.id === computer.id));
  const task = bot?.tasks?.find(item => item.threadId === bot.threadId);
  const off = bot && resolveWorkTarget(bot, task).kind === "off";
  const mode = approvalModeFor(bot ? task ? threadApproval(task, bot) : bot : {});
  const capabilities = (computer: SharedComputerStatus) => [
    (computer.botPermissions || computer.scopes.folders.length > 0) && t("computer.connected.files"),
    computer.scopes.terminal && t("computer.connected.terminal"),
    computer.scopes.screen && bot?.computer !== "off" && t("computer.connected.desktop"),
  ].filter(Boolean).join(" · ");
  if (!error && computers.length === 0 && offline.length === 0) return null;

  return <section className="mt-4 rounded-xl bg-card p-4" data-testid="connected-computers">
    <div className="flex items-center gap-1 text-[14px] font-medium text-ink">
      {t("computer.connected.title")}
      <SettingsHelp label={t("computer.connected.title")}>{t("computer.connected.help")}</SettingsHelp>
    </div>
    {error ? <div className="mt-2 flex items-center gap-2 text-[12px] text-ink-secondary" role="status">
      <span className="flex-1">{t("computer.connected.failed")}</span>
      <button type="button" onClick={() => setRetry(value => value + 1)} className="rounded p-1.5 hover:bg-control" aria-label={t("computer.connected.retry")}><RefreshCw size={14} /></button>
    </div> : <ul className="mt-2 divide-y divide-hairline/40">
      {computers.map(computer => <li key={computer.id} className="flex gap-2.5 py-2.5" data-computer-id={computer.id}>
        <Monitor size={17} className="mt-0.5 shrink-0 text-ink-secondary" aria-hidden="true" />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <span className="break-words text-[13px] font-medium text-ink">{computer.name}</span>
            <span className={`shrink-0 text-[12px] ${computer.online && (!computer.access || computer.access === "enabled") ? "text-success" : "text-ink-secondary"}`}>
              {t(computer.access === "paused" ? "workTarget.paused" : computer.access === "revoked" ? "computer.connected.unshared" : !computer.online ? "computer.connected.offline" : computer.busy ? "computer.connected.busy" : "computer.connected.online")}
            </span>
          </div>
          {!off && computer.online && (!computer.access || computer.access === "enabled") && <>
            <p className="mt-1 text-[12px] text-ink-secondary">{capabilities(computer)}</p>
            <p className="mt-1 text-[12px] text-ink-secondary">{computer.botPermissions
              ? t(mode === "full" ? "computer.connected.full" : "computer.connected.ask")
              : t("computer.connected.folders", { count: computer.scopes.folders.length })}</p>
          </>}
          {actions(computer)}
        </div>
      </li>)}
      {offline.map(computer => <li key={computer.id} className="flex items-start justify-between gap-2 py-2.5 text-[13px] text-ink-secondary" data-computer-id={computer.id}>
        <div className="min-w-0 break-words">{computer.name}{actions(computer)}</div>
        <span className="shrink-0 text-[12px]">{t(computer.lent ? "computer.connected.offline" : "computer.connected.unshared")}</span>
      </li>)}
    </ul>}
    {off && <p role="status" className="mt-2 text-[12px] text-ink-secondary">{t("place.offHint")}</p>}
    {manage && <p className="mt-2 text-[12px] text-ink-secondary">{t("workTarget.accessScope")}</p>}
    {actionError && <p role="alert" className="mt-2 text-[12px] text-danger">{actionError}</p>}
  </section>;
}
