import type { MemoryDoc, SaveResult } from "@/lib/memory";

type Conflict = { path: string; current: string; currentHash: string };
type FileDraft = {
  doc: MemoryDoc; text: string; revision: number; saving: boolean;
  conflict: Conflict | null; savedDraft: string | null; error: string | null;
};
type MemoryEditorState = {
  path: string; files: Record<string, FileDraft>; newTopic: string;
  noteDraft: string; noteSaving: boolean; noteError: string | null;
};

export function createMemoryEditor(read: (path: string) => Promise<MemoryDoc>, write: (path: string, text: string, hash: string | undefined) => Promise<SaveResult>) {
  let snapshot: MemoryEditorState = { path: "MEMORY.md", files: {}, newTopic: "", noteDraft: "", noteSaving: false, noteError: null };
  const listeners = new Set<() => void>();
  const reads = new Map<string, number>();
  const update = (patch: Partial<MemoryEditorState>) => {
    snapshot = { ...snapshot, ...patch };
    for (const listener of listeners) listener();
  };
  const setFile = (path: string, file: FileDraft) => update({ files: { ...snapshot.files, [path]: file } });
  const load = async (path: string) => {
    const request = (reads.get(path) ?? 0) + 1;
    reads.set(path, request);
    const revision = snapshot.files[path]?.revision;
    const doc = await read(path);
    const current = snapshot.files[path];
    if (reads.get(path) !== request || current?.revision !== revision || current?.saving || (current && current.text !== current.doc.text)) return;
    setFile(path, { doc, text: doc.text, revision: (revision ?? 0) + 1, saving: false, conflict: null,
      savedDraft: current?.savedDraft ?? null, error: current?.error ?? null });
  };
  return {
    getSnapshot: () => snapshot,
    subscribe(listener: () => void) { listeners.add(listener); return () => { listeners.delete(listener); }; },
    read: load,
    async open(path: string) { update({ path }); await load(path); },
    edit(path: string, text: string) {
      const file = snapshot.files[path];
      if (file) setFile(path, { ...file, text, revision: file.revision + 1, error: null });
    },
    async discard(path: string) {
      const file = snapshot.files[path];
      if (!file || file.saving) return;
      setFile(path, { ...file, text: file.doc.text, revision: file.revision + 1, conflict: null, savedDraft: null, error: null });
      await load(path);
    },
    async save(path: string, expectedHash?: string) {
      const submitted = snapshot.files[path];
      if (!submitted || submitted.saving) return;
      setFile(path, { ...submitted, saving: true, error: null });
      try {
        const result = await write(path, submitted.text, expectedHash ?? (submitted.doc.exists ? submitted.doc.hash : undefined));
        const current = snapshot.files[path];
        if (!current?.saving) return result;
        if (result.ok) {
          const text = current.revision === submitted.revision ? result.doc.text : current.text;
          setFile(path, { ...current, doc: result.doc, text, revision: current.revision + 1, saving: false, conflict: null, savedDraft: null });
        } else setFile(path, { ...current, saving: false, conflict: { path, current: result.current, currentHash: result.currentHash } });
        return result;
      } catch (cause) {
        const current = snapshot.files[path];
        if (current?.saving) setFile(path, { ...current, saving: false, error: cause instanceof Error ? cause.message : String(cause) });
      }
    },
    reloadConflict(path: string) {
      const file = snapshot.files[path];
      if (!file?.conflict) return;
      const doc = { ...file.doc, text: file.conflict.current, hash: file.conflict.currentHash, exists: true };
      setFile(path, { ...file, doc, text: doc.text, revision: file.revision + 1, savedDraft: file.text, conflict: null });
    },
    dismissSavedDraft(path: string) {
      const file = snapshot.files[path];
      if (file) setFile(path, { ...file, savedDraft: null });
    },
    remove(path: string) {
      const { [path]: _removed, ...files } = snapshot.files;
      update({ files, ...(snapshot.path === path ? { path: "MEMORY.md" } : {}) });
    },
    setNewTopic(newTopic: string) { update({ newTopic }); },
    editNote(noteDraft: string) { update({ noteDraft }); },
    clearNote(submitted: string) { if (snapshot.noteDraft === submitted) update({ noteDraft: "" }); },
    noteError(noteError: string) { update({ noteError }); },
    async changeNote(save: () => Promise<boolean>) {
      if (snapshot.noteSaving) return false;
      update({ noteSaving: true, noteError: null });
      try { return await save(); }
      catch (cause) { update({ noteError: cause instanceof Error ? cause.message : String(cause) }); return false; }
      finally { update({ noteSaving: false }); }
    },
  };
}
