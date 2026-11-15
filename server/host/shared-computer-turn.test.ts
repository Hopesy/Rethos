import { randomUUID } from "node:crypto";
import { expect, it, vi } from "vitest";
import { createSharedComputerTurn } from "./shared-computer-turn.ts";
import { SharedComputers } from "../shared-computers.ts";
import type { BotRecord, Store } from "../store.ts";
import type { WorkTarget } from "../../shared/work-target.ts";

it("binds calls and working directories to the selected device, cancels old targets and shares the screen by turn", async () => {
  const computers = new SharedComputers(() => true), id = randomUUID();
  const bot = { id: "bot", name: "Bot" } as BotRecord;
  let target: WorkTarget = { kind: "connected", computerId: id, cwd: "C:\\Projects" };
  const turns = new Set(["a", "b"]);
  const request = vi.spyOn(computers, "request").mockResolvedValue({ content: [] });
  const host = createSharedComputerTurn({ computers, bus: { store: {} as Store }, enabled: () => true,
    bot: () => bot, principal: () => "owner", unavailable: () => null, refusal: () => null,
    active: turn => turns.has(turn.generation), mode: () => "full", language: () => "en", target: () => target });
  const call = (generation: string, operation: object) => host.handle({ method: "POST", path: "/api/internal/shared-computers", bot,
    turn: { botId: bot.id, threadId: generation, generation }, readBody: async () => ({ computer_id: id, ...operation }) });
  try {
    expect(await call("a", { computer_id: randomUUID(), action: "read_file", path: "C:\\fixture" })).toMatchObject({ status: 403 });
    await call("a", { action: "run_command", command: "echo fixture" });
    expect(request.mock.calls[0]?.[0]).toMatchObject({ path: "C:\\Projects" });
    const lease = request.mock.calls[0]![2];
    target = { kind: "off" };
    expect(lease()).toBe(false);
    expect(await call("a", { action: "read_file", path: "C:\\fixture" })).toMatchObject({ status: 403 });
    target = { kind: "connected", computerId: id };
    await call("a", { action: "computer_call", tool_name: "screenshot" });
    request.mockClear();
    const waiting = call("b", { action: "computer_call", tool_name: "click" });
    expect(request).not.toHaveBeenCalled();
    turns.delete("a");
    await waiting;
    expect(request).toHaveBeenCalledTimes(1);
    host.clear("b");
  } finally { computers.close(); }
});
