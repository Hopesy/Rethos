import { randomUUID } from "node:crypto";
import { beforeEach, expect, it, vi } from "vitest";
import type { ApprovalMode } from "../shared/approval-mode.ts";
import type { BotRecord, Store } from "./store.ts";
import { personKey } from "./person-key.ts";
import { sharedComputerOperation, SharedComputers, type Registration } from "./shared-computers.ts";

const ask = vi.hoisted(() => vi.fn<(...args: unknown[]) => Promise<void>>(async () => {}));
vi.mock("./your-computer-consent.ts", () => ({ askForComputerAccess: ask, COMPUTER_ACCESS_TOOL: "computer_access" }));
import { createComputerPermissions } from "./computer-permissions.ts";

beforeEach(() => ask.mockReset().mockResolvedValue(undefined));
const registration = (): Registration => ({
  id: randomUUID(), environmentId: randomUUID(), name: "Windows computer", platform: "win32", botPermissions: true,
  terminal: true, computer: true, fileEdits: true, folders: [{ id: randomUUID(), name: "Sessions", path: "C:\\Users\\fixture\\sessions", write: false }],
});
const context = (mode: () => ApprovalMode = () => "ask") => ({
  bot: { id: "bot", name: "Bot" } as BotRecord, threadId: "thread", generation: "generation", mode, active: () => true,
});
const permissions = () => createComputerPermissions({ store: {} as Store });

it("keeps directory grants separate by read/write, bot and request, and honors cancellation", async () => {
  const gate = permissions(), computer = registration(), turn = context();
  const read = (file: string) => ({ computer_id: computer.id, action: "read_file" as const, path: file });
  await gate.authorize(computer, read("c:\\Users\\fixture\\sessions\\nested\\log.jsonl"), turn);
  expect(ask).not.toHaveBeenCalled();
  const approved = await gate.authorize(computer, read("D:\\Project\\a.txt"), turn);
  expect(approved.operation.file_scope).toEqual({ root: "D:\\Project", write: false });
  await gate.authorize(computer, read("D:\\Project\\b.txt"), turn);
  expect(ask).toHaveBeenCalledTimes(1);
  await gate.authorize(computer, read("D:\\Project\\b.txt"), { ...turn, bot: { ...turn.bot, id: "other" } });
  expect(ask).toHaveBeenCalledTimes(2);
  ask.mockRejectedValueOnce(new Error("denied"));
  await expect(gate.authorize(computer, { ...read("D:\\Project\\b.txt"), action: "write_file", content: "change" }, turn)).rejects.toThrow("denied");
  gate.clear(turn.threadId);
  await gate.authorize(computer, read("D:\\Project\\b.txt"), turn);
  expect(ask).toHaveBeenCalledTimes(4);
  await expect(gate.authorize(computer, read("D:\\Project\\..\\outside.txt"), turn)).rejects.toThrow();
});

it("uses the live Full access mode and invalidates dispatch after it is lowered", async () => {
  const gate = permissions(), computer = registration();
  let mode: ApprovalMode = "full";
  const granted = await gate.authorize(computer, { computer_id: computer.id, action: "write_file", path: "D:\\NewProject\\new.txt", content: "content" }, context(() => mode));
  expect(granted.operation.file_scope).toEqual({ root: "D:\\", write: true });
  expect(ask).not.toHaveBeenCalled();
  expect(granted.active()).toBe(true);
  mode = "ask";
  expect(granted.active()).toBe(false);
  expect(sharedComputerOperation.safeParse(granted.operation).success).toBe(false);
});

it("refuses a changed computer grant while its directory approval is pending", async () => {
  const broker = new SharedComputers(() => true), computer = registration(), secret = "a".repeat(64);
  broker.register(computer, { session: "desktop", person: "owner" }, secret);
  let allow!: () => void;
  const approval = new Promise<void>(resolve => { allow = resolve; });
  const requested = broker.request({ computer_id: computer.id, action: "read_file", path: "D:\\project\\file" }, "owner", () => true,
    async (_registered, operation) => { await approval; return { operation: { ...operation, file_scope: { root: "D:\\project", write: false } }, active: () => true }; });
  broker.register({ ...computer, folders: [] }, { session: "desktop", person: "owner" }, secret);
  allow();
  await expect(requested).rejects.toThrow("changed while waiting");
  broker.close();
});

it("recognizes a token and its browser login as the same computer owner", () => {
  const token = randomUUID();
  expect(personKey({ id: randomUUID(), loginTokenId: token })).toBe(personKey({ id: token }));
  expect(personKey({ id: randomUUID(), loginTokenId: randomUUID() })).not.toBe(personKey({ id: token }));
});
