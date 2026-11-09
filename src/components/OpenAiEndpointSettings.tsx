import { useState } from "react";
import { Loader2, RotateCw } from "lucide-react";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { t } from "@/lib/i18n";
import { cn } from "@/lib/cn";
import { KEY_FIELD } from "./keys/KeyRow";
import { SettingsHelp } from "./SettingsHelp";

export function OpenAiEndpointSettings({ instance, className, initialEditing = false }: { instance: InstanceInfo; className?: string; initialEditing?: boolean }) {
  const { dispatch, refreshInstances } = useStore();
  const endpoint = instance.openaiEndpoint;
  const [editing, setEditing] = useState(initialEditing);
  const [name, setName] = useState(instance.displayName);
  const [url, setUrl] = useState(endpoint?.url ?? "");
  const [key, setKey] = useState("");
  const [model, setModel] = useState(endpoint?.model ?? "");
  const [models, setModels] = useState(endpoint?.managedModels.join("\n") ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  if (!endpoint) return null;
  const base = `/api/instances/${encodeURIComponent(instance.instanceId)}`;
  const run = async (path: string, body?: Record<string, unknown>) => {
    if (busy) return;
    setBusy(true); setError(""); setSaved(false);
    try {
      const result = await api<{ instances?: InstanceInfo[] }>(path, { method: body ? "PATCH" : "POST", ...(body ? { body: JSON.stringify(body) } : {}) });
      if (result.instances) dispatch({ type: "instances", instances: result.instances });
      else await refreshInstances({ reportErrors: true });
      if (body) { setKey(""); setEditing(false); setSaved(true); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : t("apiInstances.failed")); }
    finally { setBusy(false); }
  };
  const edit = () => {
    setName(instance.displayName); setUrl(endpoint.url); setKey("");
    setModel(endpoint.model); setModels(endpoint.managedModels.join("\n"));
    setError(""); setSaved(false); setEditing(true);
  };
  return <div data-openai-endpoint={instance.instanceId} className={cn("min-w-0 rounded-lg border border-hairline/40 px-3 py-2.5 text-[12px] leading-5", className)}>
    {editing ? <form className="flex flex-col gap-2.5" onSubmit={(event) => {
      event.preventDefault();
      void run(`${base}/openai-endpoint`, { displayName: name.trim(), url: url.trim(), model: model.trim(),
        models: [...new Set(models.split(/[,，、\s]+/).filter(Boolean))], ...(key.trim() ? { key: key.trim() } : {}) });
    }}>
      <label className="text-ink-secondary">{t("apiInstances.name")}<input className={cn(KEY_FIELD, "mt-1 font-sans")} value={name} onChange={e => setName(e.target.value)} required maxLength={80} disabled={busy} /></label>
      <label className="text-ink-secondary">{t("apiInstances.url")}<input className={cn(KEY_FIELD, "mt-1")} type="url" value={url} onChange={e => setUrl(e.target.value)} required maxLength={512} disabled={busy} spellCheck={false} /></label>
      <label className="text-ink-secondary">{t("apiInstances.key")}<input className={cn(KEY_FIELD, "mt-1")} type="password" value={key} onChange={e => setKey(e.target.value)} placeholder={t("apiInstances.keepKey")} autoComplete="off" maxLength={4096} disabled={busy} /></label>
      <label className="text-ink-secondary">{t("apiInstances.defaultModel")}<input className={cn(KEY_FIELD, "mt-1")} value={model} onChange={e => setModel(e.target.value)} maxLength={200} disabled={busy} spellCheck={false} /></label>
      <div><div className="flex items-center gap-1 text-ink-secondary">{t("apiInstances.modelList")}<SettingsHelp label={t("apiInstances.modelList")}>{t("apiInstances.modelsHint")}</SettingsHelp></div>
        <textarea aria-label={t("apiInstances.modelList")} className={cn(KEY_FIELD, "h-20 resize-y py-1.5 leading-5")} value={models} onChange={e => setModels(e.target.value)} disabled={busy} spellCheck={false} placeholder={t("apiInstances.autoModels")} /></div>
      <div className="flex flex-wrap gap-2">
        <button type="submit" className="ui-button ui-button-primary" disabled={busy || !name.trim() || !url.trim()}>{busy && <Loader2 size={12} className="animate-spin" />}{t("common.save")}</button>
        <button type="button" className="ui-button" disabled={busy} onClick={() => { setEditing(false); setKey(""); setError(""); }}>{t("common.cancel")}</button>
      </div>
    </form> : <>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-3 gap-y-1">
        <dt className="text-ink-tertiary">{t("apiInstances.url")}</dt><dd className="break-all font-mono text-ink-secondary">{endpoint.url || "—"}</dd>
        <dt className="text-ink-tertiary">{t("apiInstances.defaultModel")}</dt><dd className="break-all font-mono text-ink-secondary">{endpoint.model || instance.models.default || "—"}</dd>
        <dt className="text-ink-tertiary">{t("apiInstances.key")}</dt><dd className="text-ink-secondary">{endpoint.keySaved ? t("apiInstances.keySaved") : t("apiInstances.keyNeeded")}</dd>
      </dl>
      <details className="mt-1 text-ink-secondary"><summary className="cursor-pointer">{t("apiInstances.availableModels", { count: instance.models.options.length })}</summary>
        <ul className="mt-1 max-h-40 overflow-y-auto font-mono text-[11px] text-ink-tertiary">{instance.models.options.map(option => <li className="break-all" key={option.id}>{option.id}</li>)}</ul>
      </details>
      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" className="ui-button" onClick={edit} disabled={busy}>{t("apiInstances.edit")}</button>
        <button type="button" className="ui-button" onClick={() => void run(`${base}/refresh-models`)} disabled={busy}>{busy ? <Loader2 size={12} className="animate-spin" /> : <RotateCw size={12} />}{t("apiInstances.refresh")}</button>
      </div>
    </>}
    {saved && <p role="status" className="mt-1 text-success">{t("common.saved")}</p>}
    {error && <p role="alert" className="mt-1 text-danger">{error}</p>}
  </div>;
}
