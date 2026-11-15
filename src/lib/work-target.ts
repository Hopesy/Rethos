import { useEffect, useRef, useState } from "react";
import { resolveWorkTarget, workTargetKey, type WorkTarget, type WorkTargetStatus } from "../../shared/work-target";
import { api } from "@/state/api";
import type { Bot } from "@/state/store";
import { t } from "./i18n";

export function targetLabel(target: WorkTarget, status?: WorkTargetStatus | null): string {
  if (target.kind === "connected") return status?.options.find(option => option.target.kind === "connected" && option.target.computerId === target.computerId)?.label ?? target.computerId;
  return t(target.kind === "private" ? target.backend === "vps" ? "place.cloud" : "place.vm" : `place.${target.kind}`);
}

export function useWorkTarget(bot: Bot, thread = false) {
  const threadId = thread ? bot.threadId : undefined;
  const key = `${bot.id}:${threadId ?? "default"}`;
  const current = useRef(key);
  current.current = key;
  const [result, setResult] = useState<{ key: string; status: WorkTargetStatus } | null>(null);
  const [failure, setFailure] = useState<{ key: string; message: string } | null>(null);
  const [saving, setSaving] = useState<string | null>(null);
  const pending = useRef(false);
  const [revision, setRevision] = useState(0);
  const endpoint = `/api/bots/${encodeURIComponent(bot.id)}/work-target`;
  const task = thread ? bot.tasks?.find(item => item.threadId === threadId) : undefined;
  const configured = resolveWorkTarget(bot, task);
  const configuredKey = workTargetKey(configured);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      try {
        const status = await api<WorkTargetStatus>(endpoint + (threadId ? `?threadId=${encodeURIComponent(threadId)}` : ""), { signal: controller.signal, background: true });
        if (!controller.signal.aborted && !pending.current) setResult({ key, status });
      } catch (error) {
        if (!controller.signal.aborted) setFailure({ key, message: String((error as Error).message) });
      }
    };
    void refresh();
    return () => controller.abort();
  }, [endpoint, threadId, key, configuredKey, revision]);
  const status = result?.key === key ? result.status : null;
  const save = async (target: WorkTarget | null, acknowledgeLocalAuto = false) => {
    if (pending.current) return false;
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
  return { status, selected: status?.selected ?? configured, saving: saving === key, error: failure?.key === key ? failure.message : null, save };
}
