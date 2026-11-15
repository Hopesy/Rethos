import type { ApprovalMode } from "../../shared/approval-mode.ts";
import { createComputerPermissions } from "../computer-permissions.ts";
import { lentScreenResult } from "../lent-screen-guidance.ts";
import { sharedComputerOperation, type SharedComputers } from "../shared-computers.ts";
import type { BotRecord } from "../store.ts";
import type { YourComputerBus } from "../your-computer-consent.ts";

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
}) {
  const permissions = createComputerPermissions(deps.bus);
  return {
    clear: permissions.clear,
    async handle(input: { method: string; path: string; turn: T; bot: BotRecord; readBody(): Promise<unknown> }) {
      if (input.path !== "/api/internal/shared-computers" || !deps.enabled()) return null;
      const { turn, bot } = input;
      if (input.method === "GET") {
        const principal = deps.principal(turn);
        return { status: 200, body: { computers: deps.computers.list(principal), ...deps.computers.away(principal), ...deps.computers.screenNotLent(principal), ...deps.unavailable(turn, principal) } };
      }
      if (input.method !== "POST") return null;
      const parsed = sharedComputerOperation.safeParse(await input.readBody());
      if (!deps.enabled()) return { status: 404, body: { error: "unknown internal endpoint" } };
      if (!parsed.success) return { status: 400, body: { error: "Invalid shared computer operation" } };
      if (["computer_tools", "computer_call"].includes(parsed.data.action) && deps.bot(turn.botId)?.computer === "off") {
        return { status: 403, body: { error: "This bot has no computer. Change its Computer setting to use a shared computer's apps and screen." } };
      }
      const principal = deps.principal(turn);
      const why = deps.refusal(turn, principal);
      if (why) return { status: 403, body: { error: why } };
      const active = () => deps.enabled() && deps.active(turn);
      const result = await deps.computers.request(parsed.data, principal, active,
        (registration, operation) => permissions.authorize(registration, operation, {
          ...turn, bot, active, language: deps.language(turn.threadId), mode: () => deps.mode(bot, turn),
        }));
      return { status: 200, body: { result: lentScreenResult(parsed.data, result) } };
    },
  };
}
