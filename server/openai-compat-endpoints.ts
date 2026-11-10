import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { InstanceConfig, InstanceConfigMap } from "./contracts.ts";
import { isCustomOpenAiEndpoint, isModelId, type OpenAiEndpointInfo, type OpenAiProtocol } from "../shared/openai-endpoint.ts";
import { boundedJson, modelApiHeaders, modelApiUrl } from "./model-api.ts";
import { object } from "./drivers/openai-chat-protocol.ts";

export const ADDED_ENDPOINT_PREFIX = "openai-compat-";

/** Origin and path only. The driver appends /models and /chat/completions, and fetch refuses URLs with credentials. */
export function endpointBaseUrl(raw: string): string | null {
  let url: URL;
  try { url = new URL(raw.trim()); } catch { return null; }
  if (url.protocol !== "https:" && url.protocol !== "http:") return null;
  if (url.username || url.password || url.search || url.hash) return null;
  return `${url.origin}${url.pathname}`.replace(/\/+$/, "");
}

/** What the instance list shows: never userinfo, query or fragment, even from a hand-edited config.json. */
export function endpointDisplayUrl(config: unknown): string | undefined {
  const raw = (config as { url?: unknown } | undefined)?.url;
  if (typeof raw !== "string") return undefined;
  try {
    const url = new URL(raw);
    return url.protocol === "https:" || url.protocol === "http:" ? `${url.origin}${url.pathname}`.replace(/\/+$/, "") : undefined;
  } catch {
    return undefined;
  }
}

const modelIdSchema = z.string().trim().refine(isModelId);

export const addEndpointSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  url: z.string().max(512),
  key: z.string().trim().min(1).max(4096),
  models: z.array(modelIdSchema).max(64).optional(),
  catalog: z.literal("lmstudio").optional(),
  protocol: z.enum(["chat", "responses", "anthropic"]).optional(),
  defaultModel: modelIdSchema.optional(),
}).strict();

export const updateEndpointSchema = addEndpointSchema.omit({ catalog: true }).partial().strict();
export const discoverEndpointSchema = z.object({
  instanceId: z.string().regex(/^[\w.-]+$/).optional(),
  url: z.string().max(512),
  key: z.string().trim().max(4096).optional(),
  protocol: z.enum(["chat", "responses", "anthropic"]).optional(),
}).strict();

export const testEndpointSchema = discoverEndpointSchema.extend({ model: modelIdSchema, protocol: z.enum(["chat", "responses", "anthropic"]) }).strict();

export function endpointKey(config: Record<string, unknown>): string {
  return typeof config.key === "string" && config.key ? config.key
    : process.env[typeof config.apiKeyEnv === "string" ? config.apiKeyEnv : "OPENAI_COMPAT_API_KEY"] ?? "";
}

export type AddEndpoint = z.infer<typeof addEndpointSchema>;

export function isAddedEndpoint(instanceId: string, entry: InstanceConfig | undefined): boolean {
  return Boolean(entry && isCustomOpenAiEndpoint(instanceId, entry.driver));
}

export function addEndpoint(instances: InstanceConfigMap, body: AddEndpoint): { instanceId: string } | { error: string } {
  const url = endpointBaseUrl(body.url);
  if (!url) return { error: "url" };
  if (/^https?:\/\//i.test(body.key)) return { error: "key" };
  const instanceId = `${ADDED_ENDPOINT_PREFIX}${randomUUID()}`;
  const models = [...new Set(body.models ?? [])];
  if (body.defaultModel && !models.includes(body.defaultModel)) return { error: "models" };
  instances[instanceId] = {
    driver: "openai-compat", displayName: body.displayName, access: "api",
    config: { key: body.key, url, ...(models.length ? { managedModels: models } : {}), ...(body.catalog ? { catalog: body.catalog } : {}),
      ...(body.protocol ? { protocol: body.protocol } : {}), ...(body.defaultModel ? { model: body.defaultModel } : {}) },
  };
  return { instanceId };
}

export function updateEndpoint(instances: InstanceConfigMap, instanceId: string, body: z.infer<typeof updateEndpointSchema>): string | null {
  const entry = instances[instanceId];
  if (!isAddedEndpoint(instanceId, entry)) return "unknown";
  const config = { ...entry.config as Record<string, unknown> };
  if (body.url !== undefined) {
    const url = endpointBaseUrl(body.url);
    if (!url) return "url";
    if (url !== endpointDisplayUrl(config) && !body.key) return "key";
    config.url = url;
  }
  if (body.key !== undefined) {
    if (/^https?:\/\//i.test(body.key)) return "key";
    config.key = body.key;
  }
  if (body.protocol !== undefined) config.protocol = body.protocol;
  if (body.models !== undefined) {
    if (!body.models.length) return "models";
    config.managedModels = [...new Set(body.models)];
    config.model = body.defaultModel ?? (body.models.includes(String(config.model)) ? config.model : body.models[0]);
  }
  if (body.defaultModel !== undefined) config.model = body.defaultModel;
  if (config.managedModels && !(config.managedModels as string[]).includes(String(config.model))) return "models";
  instances[instanceId] = { ...entry, ...(body.displayName ? { displayName: body.displayName } : {}), config };
  return null;
}

export function withEndpointUrls(described: unknown, configs: InstanceConfigMap): unknown {
  if (!Array.isArray(described)) return described;
  return described.map((instance: { instanceId?: string; models?: { default: string; options: Array<{ id: string }> }; modelsUnconfirmed?: boolean }) => {
    const entry = instance.instanceId ? configs[instance.instanceId] : undefined;
    const url = entry && isAddedEndpoint(instance.instanceId!, entry) ? endpointDisplayUrl(entry.config) : undefined;
    if (!url || !entry) return instance;
    const config = (entry.config ?? {}) as Record<string, unknown>;
    const models = Array.isArray(config.managedModels) ? config.managedModels.filter((id): id is string => typeof id === "string")
      : typeof config.model === "string" ? [config.model] : instance.modelsUnconfirmed ? [] : instance.models?.options.map(({ id }) => id) ?? [];
    const configuredDefault = typeof config.model === "string" ? config.model : instance.models?.default;
    const openaiEndpoint: OpenAiEndpointInfo = {
      protocol: config.protocol === "anthropic" ? "anthropic" : config.protocol === "responses" ? "responses" : "chat", models,
      defaultModel: configuredDefault && models.includes(configuredDefault) ? configuredDefault : models[0] ?? "",
      keySaved: Boolean(endpointKey(config)),
    };
    return { ...instance, url, openaiEndpoint };
  });
}

export async function discoverEndpointModels(url: string, key: string, protocol: OpenAiProtocol = "chat", signal = AbortSignal.timeout(8000)): Promise<{ models: string[]; error?: "unavailable" | "unauthorized" | "empty" }> {
  try {
    const init = { headers: modelApiHeaders(key, protocol), redirect: "error" as const, signal };
    let response = await fetch(modelApiUrl(url, protocol, "models"), init);
    if (response.status === 404 || response.status === 405) {
      await response.body?.cancel();
      response = await fetch(modelApiUrl(url, protocol, "model"), init);
    }
    if (!response.ok) { await response.body?.cancel(); return { models: [], error: [401, 403].includes(response.status) ? "unauthorized" : "unavailable" }; }
    const data = await boundedJson(response);
    const rows = Array.isArray(data) ? data : object(data)?.data ?? object(data)?.models;
    const models = Array.isArray(rows) ? [...new Set(rows.map((row: unknown) => typeof row === "string" ? row : (row as { id?: unknown } | null)?.id)
      .filter(isModelId))].slice(0, 1000) : [];
    return models.length ? { models } : { models, error: "empty" };
  } catch { return { models: [], error: "unavailable" }; }
}

export async function testEndpointConnection(url: string, key: string, protocol: OpenAiProtocol, model: string, signal = AbortSignal.timeout(15000)) {
  const start = performance.now();
  const result = (error?: "unauthorized" | "unavailable" | "model" | "invalid" | "timeout") => ({ ok: !error, latencyMs: Math.round(performance.now() - start), ...(error ? { error } : {}) });
  const messages = [{ role: "user", content: "Reply with OK." }];
  const body = protocol === "anthropic" ? { model, max_tokens: 16, messages, stream: false }
    : protocol === "responses" ? { model, input: "Reply with OK.", max_output_tokens: 64, store: false, stream: false }
    : { model, messages, max_completion_tokens: 64, stream: false };
  try {
    const response = await fetch(modelApiUrl(url, protocol, "completion"), {
      method: "POST", headers: modelApiHeaders(key, protocol), body: JSON.stringify(body), redirect: "error", signal,
    });
    if (!response.ok) {
      await response.body?.cancel();
      return result([401, 403].includes(response.status) ? "unauthorized" : response.status === 404 ? "model" : "unavailable");
    }
    const data = object(await boundedJson(response));
    const valid = data && !data.error && (protocol === "anthropic" ? data.type === "message" && Array.isArray(data.content) && typeof data.stop_reason === "string"
      : protocol === "responses" ? data.object === "response" && ["completed", "incomplete"].includes(String(data.status)) && Array.isArray(data.output)
      : Array.isArray(data.choices) && Boolean(object(data.choices[0])?.message));
    return result(valid ? undefined : "invalid");
  } catch { return result(signal.aborted ? "timeout" : "unavailable"); }
}
