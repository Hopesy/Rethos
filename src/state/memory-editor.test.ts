import { expect, it, vi } from "vitest";
import { createMemoryEditor } from "./memory-editor";
import type { MemoryDoc, MemoryOverview, SaveResult } from "@/lib/memory";

const doc = (text: string, hash = text, path = "MEMORY.md"): MemoryDoc => ({ path, text, hash, exists: true });
const saved = (text: string): SaveResult => ({ ok: true, doc: doc(text), overview: {} as MemoryOverview });

it("retains file drafts across subscribers and preserves newer typing when an older save finishes", async () => {
  let resolve!: (result: SaveResult) => void;
  const write = vi.fn().mockImplementationOnce(() => new Promise<SaveResult>(done => { resolve = done; })).mockResolvedValue(saved("B"));
  const editor = createMemoryEditor(async path => doc("Original", "original", path), write);
  const unmount = editor.subscribe(() => {});
  await editor.open("MEMORY.md");
  editor.edit("MEMORY.md", "A");
  const saving = editor.save("MEMORY.md");
  editor.edit("MEMORY.md", "B");
  unmount();
  await editor.open("memory/topic.md");
  editor.edit("memory/topic.md", "Topic draft");
  await editor.open("MEMORY.md");
  resolve(saved("A"));
  await saving;
  expect(editor.getSnapshot().files["MEMORY.md"]).toMatchObject({ text: "B", doc: { text: "A", hash: "A" }, saving: false });
  expect(editor.getSnapshot().files["memory/topic.md"].text).toBe("Topic draft");
  await editor.save("MEMORY.md");
  expect(write).toHaveBeenLastCalledWith("MEMORY.md", "B", "A");
  expect(editor.getSnapshot().files["MEMORY.md"]).toMatchObject({ text: "B", doc: { text: "B" } });
});

it("keeps a failed save and conflict draft through remounts and supports retrying the current text", async () => {
  const write = vi.fn().mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ ok: false, conflict: true, current: "Remote", currentHash: "remote" }).mockResolvedValue(saved("Merged"));
  const read = vi.fn().mockResolvedValueOnce(doc("Original")).mockResolvedValue(doc("Remote", "remote"));
  const editor = createMemoryEditor(read, write);
  await editor.open("MEMORY.md");
  editor.edit("MEMORY.md", "Local");
  await editor.save("MEMORY.md");
  await editor.open("MEMORY.md");
  expect(editor.getSnapshot().files["MEMORY.md"]).toMatchObject({ text: "Local", error: "offline" });
  await editor.save("MEMORY.md");
  editor.reloadConflict("MEMORY.md");
  expect(editor.getSnapshot().files["MEMORY.md"]).toMatchObject({ text: "Remote", savedDraft: "Local", conflict: null });
  await editor.open("MEMORY.md");
  expect(editor.getSnapshot().files["MEMORY.md"].savedDraft).toBe("Local");
  editor.edit("MEMORY.md", "Merged");
  await editor.save("MEMORY.md");
  expect(write).toHaveBeenLastCalledWith("MEMORY.md", "Merged", "remote");
});

it("ignores a stale read after a save and the response of an earlier file read", async () => {
  let old!: (value: MemoryDoc) => void;
  const read = vi.fn().mockResolvedValueOnce(doc("Original")).mockImplementationOnce(() => new Promise<MemoryDoc>(done => { old = done; })).mockResolvedValue(doc("Fresh"));
  const editor = createMemoryEditor(read, async (_path, text) => saved(text));
  await editor.open("MEMORY.md");
  const pending = editor.read("MEMORY.md");
  await editor.read("MEMORY.md");
  old(doc("Stale")); await pending;
  expect(editor.getSnapshot().files["MEMORY.md"].text).toBe("Fresh");
  read.mockImplementationOnce(() => new Promise<MemoryDoc>(done => { old = done; }));
  const beforeSave = editor.read("MEMORY.md");
  editor.edit("MEMORY.md", "Saved while reading");
  await editor.save("MEMORY.md");
  old(doc("Before save")); await beforeSave;
  expect(editor.getSnapshot().files["MEMORY.md"].text).toBe("Saved while reading");
});

it("preserves the simple note draft and its pending/error state and keeps new typing after adding a note", async () => {
  const editor = createMemoryEditor(async () => doc(""), async () => saved(""));
  editor.editNote("First note");
  let finish!: (value: boolean) => void;
  const pending = editor.changeNote(() => new Promise<boolean>(done => { finish = done; }));
  expect(editor.getSnapshot().noteSaving).toBe(true);
  editor.editNote("Next note");
  finish(true); await pending; editor.clearNote("First note");
  expect(editor.getSnapshot()).toMatchObject({ noteDraft: "Next note", noteSaving: false });
  await editor.changeNote(async () => { throw new Error("offline"); });
  expect(editor.getSnapshot()).toMatchObject({ noteDraft: "Next note", noteError: "offline" });
});
