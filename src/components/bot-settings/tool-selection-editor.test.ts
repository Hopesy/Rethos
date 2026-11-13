import { expect, it, vi } from "vitest";
import { createToolSelectionEditor } from "./tool-selection-editor";

it("retains an edit and a failed save across panel subscribers, then retries the same selection", async () => {
  let reject!: (error: Error) => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<void>((_resolve, fail) => { reject = fail; })).mockResolvedValue(undefined);
  const editor = createToolSelectionEditor(write);
  const draft = { custom: true, onlyListed: true, allow: "mcp:agents:create_bot", deny: "" };
  const unmount = editor.subscribe(() => {});
  editor.edit(draft);
  const pending = editor.save();
  unmount();
  expect(editor.getSnapshot()).toMatchObject({ draft, saving: true });
  reject(new Error("Save rejected"));
  await pending;
  const onChange = vi.fn();
  const close = editor.subscribe(onChange);
  expect(editor.getSnapshot()).toMatchObject({ draft, saving: false, error: "Save rejected" });
  await editor.save();
  expect(write).toHaveBeenNthCalledWith(2, { allow: ["mcp:agents:create_bot"], deny: [] });
  expect(editor.getSnapshot()).toEqual({ draft: null, saving: false, error: null });
  expect(onChange).toHaveBeenCalled();
  close();
});

it("keeps edits separate between bots and prevents duplicate writes while saving", async () => {
  let resolve!: () => void;
  const write = vi.fn(() => new Promise<void>(done => { resolve = done; }));
  const first = createToolSelectionEditor(write), second = createToolSelectionEditor(write);
  first.edit({ custom: false, onlyListed: false, allow: "", deny: "" });
  const pending = first.save();
  await first.save();
  expect(write).toHaveBeenCalledTimes(1);
  expect(second.getSnapshot().draft).toBeNull();
  resolve(); await pending;
  expect(first.getSnapshot().draft).toBeNull();
});
