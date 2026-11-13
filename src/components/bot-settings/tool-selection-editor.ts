import { useSyncExternalStore } from "react";
import { useStore, type Bot } from "@/state/store";
import { toolSelectionEditor } from "@/state/tool-selection-editor";
import { useBotEditor } from "./BotEditorContext";

export { createToolSelectionEditor, draftToolScope, type ToolSelectionDraft } from "@/state/tool-selection-editor";

export function useToolSelectionEditor(bot: Pick<Bot, "id">) {
  const { dispatch } = useStore();
  const { request, draft } = useBotEditor();
  const editor = toolSelectionEditor(draft ? request : dispatch, bot.id, async toolScope => {
    if (draft) await request(`/api/bots/${bot.id}`, { method: "PATCH", body: JSON.stringify({ toolScope: toolScope ?? null }) });
    else await new Promise<void>((resolve, reject) => dispatch({ type: "saveToolSelection", botId: bot.id, toolScope, resolve, reject }));
  });
  return { editor, ...useSyncExternalStore(editor.subscribe, editor.getSnapshot, editor.getSnapshot) };
}
