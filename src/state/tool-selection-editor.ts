import { parseToolScope, type ToolScope } from "../../shared/tool-scope";

export type ToolSelectionDraft = { custom: boolean; onlyListed: boolean; allow: string; deny: string };
const lines = (text: string) => text.split(/\r?\n/).map(line => line.trim()).filter(Boolean);

export function draftToolScope(fields: ToolSelectionDraft) {
  return parseToolScope(fields.custom ? {
    ...(fields.onlyListed ? { allow: lines(fields.allow) } : {}), deny: lines(fields.deny),
  } : undefined);
}

export function createToolSelectionEditor(write: (scope: ToolScope | undefined) => Promise<void>) {
  let snapshot = { draft: null as ToolSelectionDraft | null, saving: false, error: null as string | null };
  let pending: Promise<void> | undefined;
  let failedSave: Error | undefined;
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
      if (!snapshot.saving) { failedSave = undefined; update({ draft: null, saving: false, error: null }); }
    },
    save() {
      if (!snapshot.draft || snapshot.saving) return;
      const parsed = draftToolScope(snapshot.draft);
      if (!parsed.ok) { failedSave = new Error(parsed.error); update({ ...snapshot, error: parsed.error }); return; }
      update({ ...snapshot, saving: true, error: null });
      pending = (async () => {
        try {
          await write(parsed.scope);
          failedSave = undefined;
          update({ draft: null, saving: false, error: null });
        } catch (cause) {
          failedSave = cause instanceof Error ? cause : new Error(String(cause));
          update({ ...snapshot, saving: false, error: failedSave.message });
        }
      })();
      return pending;
    },
    async settled() {
      while (pending) {
        const current = pending;
        await current;
        if (pending === current) pending = undefined;
      }
      if (failedSave) throw failedSave;
    },
  };
}

const editors = new WeakMap<object, Map<string, ReturnType<typeof createToolSelectionEditor>>>();

export function toolSelectionEditor(owner: object, id: string, write: (scope: ToolScope | undefined) => Promise<void>) {
  let scoped = editors.get(owner);
  if (!scoped) { scoped = new Map(); editors.set(owner, scoped); }
  let editor = scoped.get(id);
  if (!editor) { editor = createToolSelectionEditor(write); scoped.set(id, editor); }
  return editor;
}

export async function waitForToolSelectionSave(owner: object, id: string) {
  await editors.get(owner)?.get(id)?.settled();
}

export async function commitToolSelectionDraft(owner: object, id: string) {
  const editor = editors.get(owner)?.get(id);
  editor?.save();
  await editor?.settled();
}
