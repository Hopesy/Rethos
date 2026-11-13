import { defaultBotPerson, type DefaultBotFields } from "./default-bot.ts";
import type { BotCapabilities } from "./bot-capabilities.ts";

export function hasDefaultBotCapabilities(bot: DefaultBotFields): boolean {
  return Boolean(bot.defaultBot) && !defaultBotPerson(bot);
}

export const DEFAULT_BOT_CAPABILITIES = {
  toolScope: undefined, memoryEnabled: true, mcpServers: undefined, composio: true, browser: true,
  connectorTools: undefined, connectorScopes: undefined, phoneApps: undefined, xResearch: true, voiceNotes: true,
} satisfies BotCapabilities;

export function defaultBotCapabilityPatch(bot: DefaultBotFields & BotCapabilities): BotCapabilities | undefined {
  if (!hasDefaultBotCapabilities(bot) || Object.entries(DEFAULT_BOT_CAPABILITIES).every(([key, value]) => bot[key as keyof BotCapabilities] === value)) return;
  return { ...DEFAULT_BOT_CAPABILITIES };
}
