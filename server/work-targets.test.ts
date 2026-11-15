import { randomUUID } from "node:crypto";
import { rmSync } from "node:fs";
import { beforeEach, expect, it, vi } from "vitest";
import { DATA_DIR } from "./config.ts";
import { Store } from "./store.ts";
import { SharedComputers } from "./shared-computers.ts";
import { createWorkTargets } from "./work-targets.ts";

const selection = () => ({ instanceId: "claude", model: "claude-sonnet-5" });
beforeEach(() => rmSync(DATA_DIR, { recursive: true, force: true }));

it("persists device and conversation choices, validates owner and platform paths, and rolls back failed saves", async () => {
  const store = new Store(selection), computers = new SharedComputers(() => true);
  const bot = store.createBot({ name: "Target fixture" });
  const a = { id: randomUUID(), name: "Desktop", environmentId: randomUUID(), folders: [], terminal: true, computer: true, platform: "win32" as const };
  const b = { ...a, id: randomUUID() };
  computers.register(a, { person: "owner", session: "token" }, "a".repeat(64));
  computers.register(b, { person: "other", session: "other-token" }, "b".repeat(64));
  const targets = createWorkTargets({ store, computers, surfaces: async () => [] });
  const target = { kind: "connected", computerId: a.id, cwd: "C:\\Projects" } as const;
  try {
    expect(() => targets.set(bot, "owner", { ...target, computerId: b.id })).toThrow(/current owner/);
    expect(() => targets.set(bot, "owner", { ...target, cwd: "relative" })).toThrow(/absolute/);
    targets.set(bot, "owner", target);
    expect(new Store(selection).bot(bot.id)?.workTarget).toEqual(target);
    targets.set(bot, "owner", { kind: "off" }, bot.threadId);
    expect((await targets.status(bot, "owner", bot.threadId)).selected).toEqual({ kind: "off" });
    targets.set(bot, "owner", null, bot.threadId);
    expect((await targets.status(bot, "owner", bot.threadId)).selected).toEqual(target);
    const automatic = store.createTask(bot.id, "Automatic selection", false)!;
    store.patchTask(bot.id, automatic.threadId, { workTarget: { kind: "private", backend: "vm" }, surfaceSource: "auto" });
    expect(store.projectBotForTask(bot.id, automatic.threadId)?.workTarget).toEqual({ kind: "private", backend: "vm" });
    const save = vi.spyOn(store as unknown as { saveBots(): void }, "saveBots").mockImplementation(() => { throw new Error("disk full"); });
    expect(() => targets.set(bot, "owner", { kind: "browser" })).toThrow(/save.*work location/);
    expect(bot.workTarget).toEqual(target);
    expect(automatic.workTarget).toEqual({ kind: "private", backend: "vm" });
    expect(() => targets.set(bot, "owner", { kind: "browser" }, bot.threadId)).toThrow();
    expect(store.taskByThread(bot.id, bot.threadId)?.workTarget).toBeUndefined();
    save.mockRestore();
    targets.set(bot, "owner", { kind: "browser" });
    expect(automatic.workTarget).toBeUndefined();
    expect(automatic.surface).toBeUndefined();
    computers.setAccess("owner", a.id, "revoked");
    expect(() => targets.set(bot, "owner", target)).toThrow(/current owner/);
  } finally { computers.close(); }
});
