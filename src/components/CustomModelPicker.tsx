import { useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CloudDownload, Loader2, Plus, X, Zap } from "lucide-react";
import { usePopoverDismiss } from "@/hooks/use-popover-dismiss";
import { pickerPlacement, type PickerPlacement } from "@/lib/picker-placement";
import { cn } from "@/lib/cn";
import { t } from "@/lib/i18n";
import { KEY_FIELD } from "./keys/KeyRow";
import { MENU_ROW, MENU_SHEET } from "./menu-recipe";
import { ModelSearch } from "./ModelPickerFull";
import { useMenuMotion } from "./MenuMotion";
import { isModelId } from "../../shared/openai-endpoint";

export function CustomModelPicker({ selected, defaultModel, available, loading, disabled, problem, autoSave, canFetch, onFetch, onChange, testing, canTest, onTest }: {
  selected: string[]; defaultModel: string; available: string[] | null;
  loading: boolean; disabled: boolean; problem: string | null; autoSave: boolean; canFetch: boolean;
  onFetch: () => void; onChange: (models: string[], defaultModel: string) => void;
  testing: boolean; canTest: boolean; onTest: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [placement, setPlacement] = useState<PickerPlacement | null>(null);
  const anchor = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const id = useId();
  const motion = useMenuMotion(open);
  const inside = useRef({ contains: (target: unknown) => target instanceof Node && Boolean(anchor.current?.contains(target) || panel.current?.contains(target)) });
  const close = () => { setOpen(false); trigger.current?.focus(); };
  usePopoverDismiss(open, inside, () => setOpen(false));
  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const box = anchor.current?.getBoundingClientRect();
      if (box) setPlacement(pickerPlacement(box, { width: box.width, height: 320 }, { width: innerWidth, height: innerHeight }, undefined, 360));
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const positioned = placement !== null;
  useEffect(() => { if (open && positioned) panel.current?.querySelector<HTMLInputElement>("input[data-menu-search]")?.focus(); }, [open, positioned]);
  const show = () => {
    if (open) { close(); return; }
    setQuery(""); setOpen(true);
    if (available === null && canFetch && !loading) onFetch();
  };
  const options = [...new Set([...(available ?? []), ...selected])];
  const search = query.trim();
  const rows = options.filter(model => model.toLowerCase().includes(search.toLowerCase()));
  const manual = isModelId(search) && !options.includes(search);
  const toggle = (model: string) => {
    const next = selected.includes(model) ? selected.filter(id => id !== model) : [...selected, model];
    onChange(next, next.includes(defaultModel) ? defaultModel : next[0] ?? "");
  };
  return <>
    <div ref={anchor} className={cn(KEY_FIELD, "flex h-auto min-h-10 items-center gap-1.5 p-1.5 font-sans leading-4")}>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1">
        {selected.map(model => <span key={model} className="inline-flex max-w-full items-center gap-1 rounded-md bg-ink/[0.05] px-2 py-1 text-[12px] text-ink-secondary">
          <button type="button" disabled={disabled} onClick={show} className="min-w-0 truncate text-left" title={model}>{model}</button>
          {model === defaultModel && <span className="shrink-0 text-[11px] text-ink-tertiary">{t("model.effort.default")}</span>}
          <button type="button" className="rounded text-ink-tertiary hover:text-ink disabled:opacity-30" disabled={disabled || (autoSave && selected.length === 1)}
            aria-label={t("customModels.removeModel", { model })} onClick={() => toggle(model)}><X size={12} aria-hidden="true" /></button>
        </span>)}
        <button ref={trigger} type="button" aria-label={t("customModels.choose")} aria-haspopup="dialog" aria-expanded={open} aria-controls={id}
          onClick={show} disabled={disabled} className="flex min-w-6 flex-1 items-center gap-1 self-stretch rounded px-1 py-1 text-left text-[12px] text-ink-tertiary hover:text-ink">
          {selected.length === 0 && <span>{t("customModels.choose")}</span>}
        </button>
      </div>
      <button type="button" className="ui-icon-button size-7 shrink-0" aria-label={t("customModels.test")} title={t("customModels.test")} aria-busy={testing} disabled={disabled || testing || !canTest} onClick={onTest}>
        {testing ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <Zap size={15} aria-hidden="true" />}
      </button>
      <button type="button" className="ui-icon-button size-7 shrink-0" aria-label={t("customModels.fetch")} title={t("customModels.fetch")} disabled={disabled || loading || !canFetch} onClick={() => { setOpen(true); onFetch(); }}>
        {loading ? <Loader2 size={15} className="animate-spin" aria-hidden="true" /> : <CloudDownload size={15} aria-hidden="true" />}
      </button>
    </div>
    {motion.shown && placement && createPortal(<div id={id} ref={panel} role="dialog" aria-label={t("customModels.choose")} {...motion.exitProps}
      style={{ position: "fixed", zIndex: 200, left: placement.left, width: placement.width, top: placement.top, bottom: placement.bottom, maxHeight: placement.maxHeight, transformOrigin: placement.origin }}
      className={cn(MENU_SHEET, "gap-0 overflow-hidden p-0", motion.className)}
      onKeyDown={event => { if (event.key === "Escape" && !event.nativeEvent.isComposing) { event.preventDefault(); event.stopPropagation(); close(); } }}>
      <div className="flex shrink-0 items-center gap-2 px-3 py-2">
        <span className="flex-1 text-[13px] font-medium text-ink">{t("customModels.choose")}</span>
        <span className="text-[12px] text-ink-tertiary">{t("customModels.enabled", { count: selected.length })}</span>
        <button type="button" className="ui-icon-button" aria-label={t("common.close")} onClick={close}><X size={14} aria-hidden="true" /></button>
      </div>
      <ModelSearch value={query} onChange={setQuery} local={false} />
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-1.5">
        {loading && <div role="status" className="flex items-center gap-2 px-2 py-2 text-[12px] text-ink-secondary"><Loader2 size={13} aria-hidden="true" className="animate-spin" />{t("customModels.fetching")}</div>}
        {problem && <p role="status" className="px-2 py-2 text-[12px] leading-5 text-ink-secondary">{problem}</p>}
        {rows.map(model => <div key={model} className={MENU_ROW}>
          <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2">
            <input type="checkbox" checked={selected.includes(model)} disabled={disabled || (autoSave && selected.length === 1 && selected.includes(model)) || (!selected.includes(model) && selected.length >= 64)}
              onChange={() => toggle(model)} className="size-3.5 shrink-0 accent-accent" />
            <span className="truncate" title={model}>{model}</span>
          </label>
          {model === defaultModel ? <span className="shrink-0 rounded bg-ink/[0.05] px-1.5 text-[11px] text-ink-secondary">{t("model.effort.default")}</span>
            : selected.includes(model) && <button type="button" disabled={disabled} onClick={() => onChange(selected, model)} aria-label={t("customModels.setDefaultFor", { model })}
              className="shrink-0 text-[12px] text-ink-tertiary hover:text-ink">{t("customModels.setDefault")}</button>}
        </div>)}
        {manual && <button type="button" className={MENU_ROW} disabled={disabled || selected.length >= 64} onClick={() => { onChange([...selected, search], defaultModel || search); setQuery(""); }}>
          <Plus size={14} aria-hidden="true" /><span className="truncate">{t("customModels.addManual", { model: search })}</span>
        </button>}
        {!loading && rows.length === 0 && !manual && <p className="px-2 py-3 text-[12px] text-ink-tertiary">{t(search ? "customModels.invalidModel" : "customModels.manualHint")}</p>}
      </div>
      <div className="flex shrink-0 items-center justify-between gap-2 border-t border-hairline/50 px-3 py-2 text-[12px] text-ink-tertiary">
        <span>{t(autoSave ? "customModels.autoSave" : "customModels.saveFirst")}</span>
        <button type="button" disabled={disabled || loading || !canFetch} className="hover:text-ink disabled:opacity-40" onClick={onFetch}>{t("customModels.refetch")}</button>
      </div>
    </div>, anchor.current?.closest('[role="dialog"]') ?? document.body)}
  </>;
}
