import { useSyncExternalStore } from "react";
import { useStore, type Bot, type BotAnnouncement } from "@/state/store";
import { parseToolScope, type ToolScope } from "../../../shared/tool-scope";
import { useBotEditor } from "./BotEditorContext";

export type ToolSelectionDraft = { custom: boolean; onlyListed: boolean; allow: string; deny: string };
const lines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function draftToolScope(fields: ToolSelectionDraft) {
  return parseToolScope(fields.custom ? {
    ...(fields.onlyListed ? { allow: lines(fields.allow) } : {}), deny: lines(fields.deny),
  } : undefined);
}

export function createToolSelectionEditor(write: (scope: ToolScope | undefined) => Promise<void>) {
  let snapshot = { draft: null as ToolSelectionDraft | null, saving: false, error: null as string | null };
  const listeners = new Set<() => void>();
  const update = (next: typeof snapshot) => {
    snapshot = next;
    for (const listener of listeners) listener();
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    edit(draft: ToolSelectionDraft) {
      if (!snapshot.saving) update({ draft, saving: false, error: null });
    },
    discard() {
      if (!snapshot.saving) update({ draft: null, saving: false, error: null });
    },
    async save() {
      if (!snapshot.draft || snapshot.saving) return;
      const parsed = draftToolScope(snapshot.draft);
      if (!parsed.ok) { update({ ...snapshot, error: parsed.error }); return; }
      update({ ...snapshot, saving: true, error: null });
      try {
        await write(parsed.scope);
        update({ draft: null, saving: false, error: null });
      } catch (cause) {
        update({ ...snapshot, saving: false, error: cause instanceof Error ? cause.message : String(cause) });
      }
    },
  };
}

const editors = new WeakMap<object, Map<string, ReturnType<typeof createToolSelectionEditor>>>();

export function useToolSelectionEditor(bot: Pick<Bot, "id">) {
  const { dispatch } = useStore();
  const { request, draft } = useBotEditor();
  const owner = draft ? request : dispatch;
  let scoped = editors.get(owner);
  if (!scoped) { scoped = new Map(); editors.set(owner, scoped); }
  let editor = scoped.get(bot.id);
  if (!editor) {
    editor = createToolSelectionEditor(async toolScope => {
      const result = await request<{ bot: BotAnnouncement }>(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ toolScope: toolScope ?? null }) });
      if (!draft) dispatch({ type: "botPatched", bot: result.bot });
    });
    scoped.set(bot.id, editor);
  }
  return { editor, ...useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot) };
}
