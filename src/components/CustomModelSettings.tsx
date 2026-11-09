import { useEffect, useRef, useState } from "react";
import { Blocks, Check, ChevronDown, Eye, EyeOff, KeyRound, Plus, Trash2, X } from "lucide-react";
import { api, useStore, type InstanceInfo } from "@/state/store";
import { addedServers } from "@/lib/openai-compat-endpoints";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import type { OpenAiProtocol } from "../../shared/openai-endpoint";
import { Card, SettingsGroup } from "./SettingsPrimitives";
import { SettingsHelp } from "./SettingsHelp";
import { SidebarPopoverMenu } from "./SidebarPopoverMenu";
import { KEY_FIELD, KeyStatusChip } from "./keys/KeyRow";
import { CustomModelPicker } from "./CustomModelPicker";

type Draft = { url: string; key: string; protocol: OpenAiProtocol; models: string[]; defaultModel: string };
function fromServer(server?: InstanceInfo): Draft {
  return { url: server?.url ?? "", key: "", protocol: server?.openaiEndpoint?.protocol ?? "chat",
    models: server?.openaiEndpoint?.models ?? [], defaultModel: server?.openaiEndpoint?.defaultModel ?? "" };
}
const address = (value: string) => value.trim().replace(/\/+$/, "");
const validAddress = (value: string) => { try { const url = new URL(value); return /^https?:$/.test(url.protocol) && !url.username && !url.password && !url.search && !url.hash; } catch { return false; } };

export function CustomModelCard({ server, onDone }: { server?: InstanceInfo; onDone?: () => void }) {
  const { dispatch, refreshInstances } = useStore();
  const [draft, setDraft] = useState(() => fromServer(server));
  const [shown, setShown] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [available, setAvailable] = useState<string[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [fetchProblem, setFetchProblem] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null);
  const busy = useRef(false);
  const baseline = JSON.stringify(fromServer(server));
  const dirty = JSON.stringify(draft) !== baseline;
  const previousBaseline = useRef(baseline);
  useEffect(() => {
    const previous = previousBaseline.current;
    previousBaseline.current = baseline;
    if (!busy.current) setDraft(current => JSON.stringify(current) === previous ? JSON.parse(baseline) as Draft : current);
  }, [baseline]);
  useEffect(() => () => request.current?.abort(), []);
  const existingKey = Boolean(server?.openaiEndpoint?.keySaved && address(draft.url) === address(server.url ?? ""));
  const canFetch = validAddress(draft.url) && Boolean(draft.key.trim() || existingKey);
  const canSave = Boolean(canFetch && draft.models.length && draft.models.includes(draft.defaultModel));
  const updateConnection = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    request.current?.abort(); request.current = null; setLoading(false); setAvailable(null); setFetchProblem(null); setProblem(null); setSaved(false);
    setDraft(current => ({ ...current, [key]: value }));
  };
  const apply = async (result: { instances?: InstanceInfo[] }) => {
    if (Array.isArray(result.instances)) dispatch({ type: "instances", instances: result.instances });
    else await refreshInstances({ reportErrors: true });
  };
  const save = async (next: Draft, modelsOnly = false) => {
    if (busy.current) return;
    const before = draft;
    busy.current = true; setSaving(true); setProblem(null); setSaved(false); setDraft(next);
    try {
      const payload = modelsOnly ? { models: next.models, defaultModel: next.defaultModel }
        : { ...(!server ? { displayName: new URL(next.url).host.slice(0, 80) } : {}), url: address(next.url), protocol: next.protocol, models: next.models, defaultModel: next.defaultModel, ...(next.key.trim() ? { key: next.key.trim() } : {}) };
      const result = await api<{ instanceId?: string; instances: InstanceInfo[] }>(server ? `/api/instances/${encodeURIComponent(server.instanceId)}/openai-endpoint` : "/api/instances/openai-compat", {
        method: server ? "PATCH" : "POST", body: JSON.stringify(payload),
      });
      await apply(result);
      const updated = result.instances.find(instance => instance.instanceId === (server?.instanceId ?? result.instanceId));
      setDraft(updated ? fromServer(updated) : { ...next, key: "" }); setShown(false); setSaved(true);
      if (!server) onDone?.();
    } catch (error) {
      if (modelsOnly) setDraft(before);
      setProblem(error instanceof Error ? error.message : t("serverError.endpoint.save"));
    } finally { busy.current = false; setSaving(false); }
  };
  const fetchModels = async () => {
    if (!canFetch) return;
    request.current?.abort();
    const controller = new AbortController(); request.current = controller;
    setLoading(true); setFetchProblem(null);
    try {
      const result = await api<{ models: string[]; error?: "unavailable" | "unauthorized" | "empty" }>("/api/instances/openai-compat/models", {
        method: "POST", signal: controller.signal, body: JSON.stringify({ url: address(draft.url), ...(server ? { instanceId: server.instanceId } : {}), ...(draft.key.trim() ? { key: draft.key.trim() } : {}) }),
      });
      if (request.current !== controller) return;
      setAvailable(result.models);
      setFetchProblem(result.error ? t(result.error === "unauthorized" ? "customModels.authFailed" : result.error === "empty" ? "customModels.empty" : "customModels.fetchFailed") : null);
    } catch {
      if (request.current === controller && !controller.signal.aborted) { setAvailable([]); setFetchProblem(t("customModels.fetchFailed")); }
    } finally { if (request.current === controller) setLoading(false); }
  };
  const remove = async () => {
    if (!server || busy.current) return;
    busy.current = true; setSaving(true); setProblem(null);
    try { await apply(await api(`/api/instances/${encodeURIComponent(server.instanceId)}`, { method: "DELETE" })); }
    catch (error) { setProblem(error instanceof Error ? error.message : t("serverError.endpoint.save")); }
    finally { busy.current = false; setSaving(false); }
  };
  const selectModels = (models: string[], defaultModel: string) => {
    if (busy.current) return;
    const next = { ...draft, models, defaultModel };
    if (server && !dirty && models.length > 0) void save(next, true);
    else { setDraft(next); setSaved(false); }
  };
  return <div data-custom-model={server?.instanceId ?? "new"}>
    <Card compact title={t("customModels.connection")} actions={<>
      <KeyStatusChip status={saving ? { tone: "busy", text: t("common.saving") } : saved && !dirty ? { tone: "ok", text: t("common.saved") } : null} />
      {(dirty || !server) && <button type="button" className="ui-button ui-button-primary" disabled={saving || !canSave} onClick={() => void save(draft)}>{t("common.save")}</button>}
      <button type="button" className="ui-icon-button" disabled={saving} aria-label={server ? t("apiInstances.remove", { name: server.displayName }) : t("common.cancel")} onClick={() => server ? void remove() : onDone?.()}>
        {server ? <Trash2 size={13} aria-hidden="true" /> : <X size={13} aria-hidden="true" />}
      </button>
    </>}>
      <div className="flex flex-col gap-3">
        <div className="grid min-w-0 grid-cols-1 gap-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
          <fieldset disabled={saving} className="min-w-0 text-[12px] text-ink-secondary [&_[role=menu]]:w-full [&_[role=menuitemradio]]:text-[13px]">
            <legend className="mb-1 flex h-6 items-center">{t("customModels.protocol")}</legend>
            <SidebarPopoverMenu placement="below" ariaLabel={t("customModels.protocol")}
              triggerClassName={cn(KEY_FIELD, "flex items-center justify-between gap-2 font-sans text-left")}
              items={([['chat', 'Chat Completions'], ['responses', 'Responses']] as const).map(([value, label]) => ({
                key: value, label, checked: draft.protocol === value, disabled: saving,
                trailing: draft.protocol === value ? <Check size={14} className="text-ink-secondary" aria-hidden="true" /> : undefined,
                onSelect: () => updateConnection("protocol", value),
              }))}
              renderTrigger={() => <><span className="truncate">{draft.protocol === "responses" ? "Responses" : "Chat Completions"}</span><ChevronDown size={13} aria-hidden="true" className="shrink-0 text-ink-tertiary" /></>} />
          </fieldset>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-secondary">
          <span className="flex items-center">{t("customModels.address")}<SettingsHelp label={t("customModels.address")}>{t("customModels.addressHelp")}</SettingsHelp></span>
          <input aria-label={t("customModels.address")} type="url" className={cn(KEY_FIELD, "font-sans")} value={draft.url} onChange={event => updateConnection("url", event.target.value)} disabled={saving} spellCheck={false} placeholder="https://api.example.com/v1" />
        </label>
        </div>
        <label className="flex min-w-0 flex-col gap-1 text-[12px] text-ink-secondary">{t("apiInstances.key")}
          <span className="relative flex items-center">
            <KeyRound size={14} aria-hidden="true" className="pointer-events-none absolute left-3 text-ink-tertiary" />
            <input type={shown ? "text" : "password"} className={cn(KEY_FIELD, "pl-9 pr-9")} autoComplete="off" value={draft.key} onChange={event => updateConnection("key", event.target.value)} disabled={saving} placeholder={existingKey ? t("customModels.keySaved") : t("apiInstances.key")} />
            <button type="button" className="ui-icon-button absolute right-1" aria-label={t(shown ? "keys.row.hide" : "keys.row.show")} disabled={!draft.key} onClick={() => setShown(value => !value)}>
              {shown ? <EyeOff size={14} aria-hidden="true" /> : <Eye size={14} aria-hidden="true" />}
            </button>
          </span>
        </label>
        <div className="-mx-3.5 mt-1 border-t border-hairline/50 px-3.5 pt-3 max-[480px]:-mx-3 max-[480px]:px-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] text-ink-secondary"><Blocks size={14} aria-hidden="true" /><span>{t("customModels.models")}</span><span className="text-ink-tertiary">{t("customModels.enabled", { count: draft.models.length })}</span></div>
          <CustomModelPicker selected={draft.models} defaultModel={draft.defaultModel} available={available} loading={loading} disabled={saving} problem={fetchProblem}
            autoSave={Boolean(server && !dirty)} canFetch={canFetch} onFetch={() => void fetchModels()} onChange={selectModels} />
        </div>
        {problem && <p role="alert" className="text-[12px] leading-5 text-danger">{problem}</p>}
      </div>
    </Card>
  </div>;
}

export function CustomModelSettings() {
  const { state } = useStore();
  const servers = addedServers(state.instances).filter(server => !server.readOnly);
  const [adding, setAdding] = useState(false);
  if (state.instances.length > 0 && state.instances.every(server => server.readOnly)) return null;
  return <SettingsGroup label={t("customModels.title")} actions={<button type="button" className="ui-button" disabled={adding} onClick={() => setAdding(true)}><Plus size={13} aria-hidden="true" />{t("customModels.addConnection")}</button>}>
    {servers.map(server => <CustomModelCard key={server.instanceId} server={server} />)}
    {adding && <CustomModelCard onDone={() => setAdding(false)} />}
    {!adding && servers.length === 0 && <p className="text-[12px] text-ink-tertiary">{t("customModels.start")}</p>}
  </SettingsGroup>;
}
