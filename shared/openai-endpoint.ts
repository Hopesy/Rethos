export function isCustomOpenAiEndpoint(instanceId: string, driver: string): boolean {
  return driver === "openai-compat" && !["openaiCompat", "openai", "openrouter"].includes(instanceId) && !instanceId.startsWith("company.");
}

export type OpenAiProtocol = "chat" | "responses";

export function isModelId(value: unknown): value is string {
  return typeof value === "string" && value.length > 0 && value.length <= 200 && !/\s/u.test(value)
    && [...value].every(char => char.charCodeAt(0) > 31 && char.charCodeAt(0) !== 127);
}

/** Public connection settings; a saved API key is represented only by its presence. */
export interface OpenAiEndpointInfo {
  protocol: OpenAiProtocol;
  models: string[];
  defaultModel: string;
  keySaved: boolean;
}
