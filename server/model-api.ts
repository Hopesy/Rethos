import type { OpenAiProtocol } from "../shared/openai-endpoint.ts";

export function modelApiUrl(base: string, protocol: OpenAiProtocol, operation: "models" | "model" | "completion"): string {
  const url = base.replace(/\/+$/, "");
  const prefix = protocol === "anthropic" && !url.endsWith("/v1") ? `${url}/v1` : url;
  const path = operation === "completion" ? protocol === "anthropic" ? "messages" : protocol === "responses" ? "responses" : "chat/completions" : operation;
  return `${prefix}/${path}`;
}

export function modelApiHeaders(key: string, protocol: OpenAiProtocol): Record<string, string> {
  return { "content-type": "application/json", ...(protocol === "anthropic"
    ? { "x-api-key": key, "anthropic-version": "2023-06-01" }
    : { authorization: `Bearer ${key}` }) };
}

export async function boundedJson(response: Response, limit = 2 * 1024 * 1024): Promise<unknown> {
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty response");
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.length;
      if (length > limit) { await reader.cancel(); throw new Error("Response too large"); }
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
