import { useSyncExternalStore } from "react";
import { fetchMemoryDoc, saveMemoryDoc } from "@/lib/memory";
import { useStore } from "@/state/store";
import { createMemoryEditor } from "@/state/memory-editor";

const editors = new WeakMap<object, Map<string, ReturnType<typeof createMemoryEditor>>>();

export function useMemoryEditor(botId: string, mine = false) {
  const { dispatch } = useStore();
  let scoped = editors.get(dispatch);
  if (!scoped) { scoped = new Map(); editors.set(dispatch, scoped); }
  const key = `${botId}:${mine ? "mine" : "team"}`;
  let editor = scoped.get(key);
  if (!editor) {
    editor = createMemoryEditor(path => fetchMemoryDoc(botId, path, mine), (path, text, hash) => saveMemoryDoc(botId, path, text, hash, mine));
    scoped.set(key, editor);
  }
  return { editor, state: useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot) };
}
