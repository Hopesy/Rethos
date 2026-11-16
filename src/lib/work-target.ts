import { useEffect, useRef, useState } from "react";
import { resolveWorkTarget, workTargetKey, type WorkTarget, type WorkTargetStatus } from "../../shared/work-target";
import { api } from "@/state/api";
import type { Bot } from "@/state/store";
import { t } from "./i18n";

export function targetLabel(target: WorkTarget, status?: WorkTargetStatus | null): string {
  if (target.kind === "connected") return status?.options.find(option => option.target.kind === "connected" && option.target.computerId === target.computerId)?.label ?? target.computerId;
  if (target.kind === "local") return t("workTarget.host");
  if (target.kind === "auto") return t("workTarget.auto");
  return t(target.kind === "private" ? target.backend === "vps" ? "place.cloud" : "place.vm" : `place.${target.kind}`);
}

export function useWorkTarget(bot: Bot, thread = false, live = false) {
  const threadId = thread ? bot.threadId : undefined;
  const key = `${bot.id}:${threadId ?? "default"}`;
  const current = useRef(key);
  current.current = key;
  const [result, setResult] = useState<{ key: string; status: WorkTargetStatus } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const pending = useRef(false);
  const requestVersion = useRef(0);
  const [revision, setRevision] = useState(0);
  const endpoint = `/api/bots/${encodeURIComponent(bot.id)}/work-target`;
  const task = thread ? bot.tasks?.find(item => item.threadId === threadId) : undefined;
  const configured = resolveWorkTarget(bot, task);
  const configuredKey = workTargetKey(configured);
  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let refreshing = false;
    const refresh = async () => {
      if (refreshing || controller.signal.aborted) return;
      clearTimeout(timer);
      refreshing = true;
      const version = requestVersion.current;
      try {
        if ((live && document.visibilityState === "hidden") || pending.current) return;
        const status = await api<WorkTargetStatus>(endpoint + (threadId ? `?threadId=${encodeURIComponent(threadId)}` : ""), { signal: controller.signal, background: true });
        if (!controller.signal.aborted && version === requestVersion.current && !pending.current) {
          setResult({ key, status });
          setFailure(null);
        }
      } catch (error) {
        if (!controller.signal.aborted && version === requestVersion.current) setFailure({ key, message: String((error as Error).message) });
      } finally {
        refreshing = false;
        if (live && !controller.signal.aborted) timer = setTimeout(() => void refresh(), 10_000);
      }
    };
    const visible = () => { if (document.visibilityState !== "hidden") void refresh(); };
    if (live) {
      window.addEventListener("focus", visible);
      document.addEventListener("visibilitychange", visible);
    }
    void refresh();
    return () => {
      controller.abort(); clearTimeout(timer);
      window.removeEventListener("focus", visible);
      document.removeEventListener("visibilitychange", visible);
    };
  }, [endpoint, threadId, key, configuredKey, revision, live]);
  const status = result?.key === key ? result.status : null;
  const save = async (target: WorkTarget | null, acknowledgeLocalAuto = false) => {
    if (pending.current) return false;
    requestVersion.current += 1;
    pending.current = true; setSaving(key); setFailure(null);
    try {
      const next = await api<WorkTargetStatus>(endpoint, { method: "PATCH", body: JSON.stringify({ target, acknowledgeLocalAuto, ...(threadId ? { threadId } : {}) }) });
      if (current.current !== key) return false;
      setResult({ key, status: next });
      setRevision(value => value + 1);
      return true;
    } catch (error) {
      if (current.current === key) setFailure({ key, message: String((error as Error).message) });
      return false;
    } finally { pending.current = false; setSaving(null); }
  };
  return { status, selected: status?.selected ?? configured, saving: saving === key, error: failure?.key === key ? failure.message : null, save, refresh: () => setRevision(value => value + 1) };
}
