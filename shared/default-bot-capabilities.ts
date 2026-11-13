import { defaultBotPerson, type DefaultBotFields } from "./default-bot.ts";
import type { ToolScope } from "./tool-scope.ts";

export function hasDefaultBotCapabilities(bot: DefaultBotFields): boolean {
  return Boolean(bot.defaultBot) && !defaultBotPerson(bot);
}

type Capabilities = { toolScope?: ToolScope; memoryEnabled?: boolean };

export function defaultBotCapabilityPatch(bot: DefaultBotFields & Capabilities): Partial<Capabilities> | undefined {
  if (!hasDefaultBotCapabilities(bot) || (bot.toolScope === undefined && bot.memoryEnabled === true)) return;
  return { toolScope: undefined, memoryEnabled: true };
}
