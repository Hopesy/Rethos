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
  const gate = permissions(), computer = registration(), grant = Symbol(), turn = context();
  const read = (file: string) => ({ computer_id: computer.id, action: "read_file" as const, path: file });
  await gate.authorize(computer, read("c:\\Users\\fixture\\sessions\\nested\\log.jsonl"), grant, turn);
  expect(ask).not.toHaveBeenCalled();
  const approved = await gate.authorize(computer, read("D:\\Project\\a.txt"), grant, turn);
  expect(approved.operation.file_scope).toEqual({ root: "D:\\Project", write: false });
  await gate.authorize(computer, read("D:\\Project\\b.txt"), grant, turn);
  expect(ask).toHaveBeenCalledTimes(1);
  await gate.authorize(computer, read("D:\\Project\\b.txt"), grant, { ...turn, bot: { ...turn.bot, id: "other" } });
  expect(ask).toHaveBeenCalledTimes(2);
  ask.mockRejectedValueOnce(new Error("denied"));
  await expect(gate.authorize(computer, { ...read("D:\\Project\\b.txt"), action: "write_file", content: "change" }, grant, turn)).rejects.toThrow("denied");
  gate.clear(turn.threadId);
  await gate.authorize(computer, read("D:\\Project\\b.txt"), grant, turn);
  expect(ask).toHaveBeenCalledTimes(4);
  await expect(gate.authorize(computer, read("D:\\Project\\..\\outside.txt"), grant, turn)).rejects.toThrow();
});

it("uses the live Full access mode and invalidates dispatch after it is lowered", async () => {
  const gate = permissions(), computer = registration();
  let mode: ApprovalMode = "full";
  const granted = await gate.authorize(computer, { computer_id: computer.id, action: "write_file", path: "D:\\NewProject\\new.txt", content: "content" }, Symbol(), context(() => mode));
  expect(granted.operation.file_scope).toEqual({ root: "D:\\", write: true });
  expect(ask).not.toHaveBeenCalled();
  expect(granted.active()).toBe(true);
  mode = "ask";
  expect(granted.active()).toBe(false);
  expect(sharedComputerOperation.safeParse(granted.operation).success).toBe(false);
});

it("keeps the same computer grant through approval, delivery and completion after registration refreshes", async () => {
  const broker = new SharedComputers(() => true), computer = registration(), secret = "a".repeat(64);
  const owner = { session: "desktop", person: "owner" };
  const refresh = () => broker.register(structuredClone(computer), owner, secret);
  refresh();
  try {
    const requested = broker.request({ computer_id: computer.id, action: "computer_tools" }, owner.person, () => true,
      async (_registration, operation) => { refresh(); return { operation, active: () => true }; });
    const job = await Promise.race([broker.poll(computer.id, owner.session, secret), requested.then(() => null)]);
    expect(job?.operation.action).toBe("computer_tools");
    refresh();
    expect(broker.liveJob(computer.id, owner.session, secret, job!.id)).toBe(true);
    broker.register({ ...computer, name: "Renamed desktop" }, owner, secret);
    broker.complete(computer.id, owner.session, secret, job!.id, ["list_windows"]);
    await expect(requested).resolves.toEqual(["list_windows"]);
  } finally { broker.close(); }
});

it.each(["folder change", "pause and resume", "revoke and renew"])("discards pending directory approval after %s even after access is restored", async change => {
  const broker = new SharedComputers(() => true), computer = registration(), secret = "a".repeat(64);
  const owner = { session: "desktop", person: "owner" };
  broker.register(computer, owner, secret);
  let allow!: () => void;
  const approval = new Promise<void>(resolve => { allow = resolve; });
  ask.mockImplementationOnce(() => approval);
  const gate = permissions(), turn = context();
  const read = () => broker.request({ computer_id: computer.id, action: "read_file", path: "D:\\project\\file" }, owner.person, turn.active,
    (registered, operation, grant) => gate.authorize(registered, operation, grant, turn));
  const requested = read();
  if (change === "folder change") {
    broker.register({ ...computer, folders: [] }, owner, secret);
    broker.register(computer, owner, secret);
  } else if (change === "pause and resume") {
    broker.setAccess(owner.person, computer.id, "paused");
    broker.setAccess(owner.person, computer.id, "enabled");
  } else {
    broker.setAccess(owner.person, computer.id, "revoked");
    broker.register({ ...computer, grantRevision: randomUUID() }, owner, secret);
  }
  allow();
  await expect(requested).rejects.toThrow("permissions changed");
  ask.mockRejectedValueOnce(new Error("fresh approval denied"));
  await expect(read()).rejects.toThrow("fresh approval denied");
  broker.close();
});

it("recognizes a token and its browser login as the same computer owner", () => {
  const token = randomUUID();
  expect(personKey({ id: randomUUID(), loginTokenId: token })).toBe(personKey({ id: token }));
  expect(personKey({ id: randomUUID(), loginTokenId: randomUUID() })).not.toBe(personKey({ id: token }));
});
