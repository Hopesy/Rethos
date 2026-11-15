import type { ApprovalMode } from "../../shared/approval-mode.ts";
import { createComputerPermissions } from "../computer-permissions.ts";
import { lentScreenResult } from "../lent-screen-guidance.ts";
import { sharedComputerOperation, type SharedComputers } from "../shared-computers.ts";
import type { BotRecord } from "../store.ts";
import type { YourComputerBus } from "../your-computer-consent.ts";
import { connectedTargetRefusal, workTargetKey, type WorkTarget } from "../../shared/work-target.ts";
import { TurnResources } from "../turn-resources.ts";
import { allowsTool } from "../../shared/tool-scope.ts";

type Turn = { botId: string; threadId: string; generation: string };

export function createSharedComputerTurn<T extends Turn>(deps: {
  bus: YourComputerBus;
  computers: SharedComputers;
  enabled(): boolean;
  bot(id: string): BotRecord | null;
  principal(turn: T): string | null;
  unavailable(turn: T, principal: string | null): { unavailable: string | null; say: string } | null;
  refusal(turn: T, principal: string | null): string | null;
  active(turn: T): boolean;
  mode(bot: BotRecord, turn: T): ApprovalMode;
  language(threadId: string): string | undefined;
  target?(turn: T): WorkTarget | undefined;
  resources?: TurnResources;
}) {
  const permissions = createComputerPermissions(deps.bus);
  const resources = deps.resources ?? new TurnResources();
  const screenTurns = new Map<string, { turn: T; active(): boolean }>();
  return {
    clear(threadId: string) {
      permissions.clear(threadId);
      for (const [resource, holder] of screenTurns) if (holder.turn.threadId === threadId) {
        resources.releaseOne(resource, holder.turn); screenTurns.delete(resource);
      }
    },
    async handle(input: { method: string; path: string; turn: T; bot: BotRecord; readBody(): Promise<unknown> }) {
      if (input.path !== "/api/internal/shared-computers" || !deps.enabled()) return null;
      const { turn, bot } = input;
      const target = deps.target?.(turn);
      if (input.method === "GET") {
        const principal = deps.principal(turn);
        return { status: 200, body: { computers: deps.computers.list(principal), target, ...deps.computers.away(principal), ...deps.computers.screenNotLent(principal), ...deps.unavailable(turn, principal) } };
      }
      if (input.method !== "POST") return null;
      const parsed = sharedComputerOperation.safeParse(await input.readBody());
      if (!deps.enabled()) return { status: 404, body: { error: "unknown internal endpoint" } };
      if (!parsed.success) return { status: 400, body: { error: "Invalid shared computer operation" } };
      if (deps.bot(turn.botId)?.computer === "off" || target?.kind === "off") {
        return { status: 403, body: { error: "Computer access is off for this bot." } };
      }
      const targetRefusal = connectedTargetRefusal(target, parsed.data.computer_id);
      if (targetRefusal) return { status: 403, body: { error: targetRefusal } };
      if (target?.kind === "connected" && target.cwd && parsed.data.action === "run_command" && !parsed.data.path) parsed.data.path = target.cwd;
      const principal = deps.principal(turn);
      const why = deps.refusal(turn, principal);
      if (why) return { status: 403, body: { error: why } };
      const selected = target && workTargetKey(target);
      const active = () => {
        const current = deps.target?.(turn);
        const liveBot = deps.bot(turn.botId);
        return deps.enabled() && deps.active(turn) && liveBot?.computer !== "off" && selected === (current && workTargetKey(current))
          && deps.computers.accessMode(principal, parsed.data.computer_id) === "enabled"
          && allowsTool(liveBot?.toolScope, { kind: "mcp", server: "agents", name: "shared_computer" }, parsed.data);
      };
      if (parsed.data.action === "computer_call") {
        const resource = `connected:${principal}:${parsed.data.computer_id}`;
        const previous = screenTurns.get(resource);
        if (previous && !previous.active()) { resources.releaseOne(resource, previous.turn); screenTurns.delete(resource); }
        resources.startWaiting(resource, turn);
        try {
          const deadline = Date.now() + 30_000;
          while (!resources.claim(resource, turn)) {
            if (!active()) return { status: 409, body: { error: "This computer request ended while waiting for its screen." } };
            if (Date.now() >= deadline) return { status: 409, body: { error: "Another conversation is using this computer's screen. Retry after it finishes." } };
            const holder = screenTurns.get(resource);
            if (holder && !holder.active()) { resources.releaseOne(resource, holder.turn); screenTurns.delete(resource); }
            await new Promise(resolve => setTimeout(resolve, 100));
          }
          screenTurns.set(resource, { turn, active });
        } finally { resources.stopWaiting(resource, turn); }
      }
      const result = await deps.computers.request(parsed.data, principal, active,
        (registration, operation) => permissions.authorize(registration, operation, {
          ...turn, bot, active, language: deps.language(turn.threadId), mode: () => deps.mode(bot, turn),
        }));
      return { status: 200, body: { result: lentScreenResult(parsed.data, result) } };
    },
  };
}
