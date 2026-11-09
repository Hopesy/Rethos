/** Public settings for a custom OpenAI-compatible service. Credentials remain on the server. */
export interface OpenAiEndpointInfo {
  url: string;
  keySaved: boolean;
  model: string;
  managedModels: string[];
}

export function isCustomOpenAiEndpoint(instanceId: string, driver: string): boolean {
  return driver === "openai-compat" && !["openaiCompat", "openai", "openrouter"].includes(instanceId) && !instanceId.startsWith("company.");
}
