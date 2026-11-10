import type { Agent } from "undici";
import type { OpenAiProtocol } from "../../shared/openai-endpoint.ts";
import { modelApiHeaders, modelApiUrl } from "../model-api.ts";
import { RuntimeNoticeError } from "./runtime-notice-error.ts";

// Node's fetch (undici 7.29 in Electron 43, 8.9 in Node 26) fails a request after 300 s without response headers
// or body bytes, whatever its signal allows. A local model sends nothing until its first token.
export const FETCH_LIMIT_MS = 300_000;
let unlimitedAgent: Agent | undefined;

export async function fetchPastLimit(url: string, init: RequestInit): Promise<Response> {
  const { Agent: UndiciAgent, fetch: fetchWithoutLimits } = await import("undici");
  unlimitedAgent ??= new UndiciAgent({ headersTimeout: 0, bodyTimeout: 0 });
  return fetchWithoutLimits(url, { ...init, dispatcher: unlimitedAgent } as Parameters<typeof fetchWithoutLimits>[1]) as unknown as Promise<Response>;
}

export function watchModelServer(options: { apiUrl: string; apiKey: string; protocol?: OpenAiProtocol }, everyMs: number, stop: (reason: Error) => void): NodeJS.Timeout {
  let misses = 0;
  const timer = setInterval(() => {
    fetch(modelApiUrl(options.apiUrl, options.protocol ?? "chat", "models"), { headers: modelApiHeaders(options.apiKey, options.protocol ?? "chat"), redirect: "error", signal: AbortSignal.timeout(everyMs) })
      .then((response) => { misses = 0; void response.body?.cancel(); })
      .catch(() => {
        if (++misses === 3) stop(new RuntimeNoticeError(`The model server at ${new URL(options.apiUrl).host} stopped answering, so the reply was stopped.`, "chat.notice.modelServerStoppedAnswering", { host: new URL(options.apiUrl).host }));
      });
  }, everyMs);
  timer.unref();
  return timer;
}
