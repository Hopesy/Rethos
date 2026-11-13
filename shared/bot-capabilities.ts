import type { WireBot } from "./wire.ts";

export const BOT_CAPABILITY_FIELDS = [
  "toolScope", "memoryEnabled", "memoryUpkeep", "mcpServers", "composio", "browser",
  "connectorTools", "connectorScopes", "phoneApps", "xResearch", "voiceNotes",
] as const satisfies readonly (keyof WireBot)[];

export type BotCapabilities = Pick<WireBot, typeof BOT_CAPABILITY_FIELDS[number]>;

export function botCapabilities(bot: { [K in keyof BotCapabilities]?: BotCapabilities[K] | null }): BotCapabilities {
  return Object.fromEntries(BOT_CAPABILITY_FIELDS.filter(key => bot[key] != null)
    .map(key => [key, structuredClone(bot[key])])) as BotCapabilities;
}
