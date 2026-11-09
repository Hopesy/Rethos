import { randomUUID } from "node:crypto";
import { z } from "zod";
import type { InstanceConfig, InstanceConfigMap } from "./contracts.ts";
import { isCustomOpenAiEndpoint } from "../shared/openai-endpoint.ts";

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

export const addEndpointSchema = z.object({
  displayName: z.string().trim().min(1).max(80),
  url: z.string().max(512),
  key: z.string().trim().min(1).max(4096),
  models: z.array(z.string().trim().min(1).max(200)).max(64).optional(),
  catalog: z.literal("lmstudio").optional(),
}).strict();

export type AddEndpoint = z.infer<typeof addEndpointSchema>;

export function isAddedEndpoint(instanceId: string, entry: InstanceConfig | undefined): boolean {
  return Boolean(entry && isCustomOpenAiEndpoint(instanceId, entry.driver));
}

export const updateEndpointSchema = addEndpointSchema.omit({ catalog: true }).extend({
  key: addEndpointSchema.shape.key.optional(),
  model: z.string().trim().max(200).optional(),
});

export function updateEndpoint(instances: InstanceConfigMap, instanceId: string, body: z.infer<typeof updateEndpointSchema>): { error: string } | null {
  const entry = instances[instanceId];
  if (!isAddedEndpoint(instanceId, entry)) return { error: "This service is managed in its own provider settings." };
  const url = endpointBaseUrl(body.url);
  if (!url) return { error: "Enter an http or https base URL without a user name, password or query string." };
  if (body.key && /^https?:\/\//i.test(body.key)) return { error: "Enter the API key itself." };
  const config: Record<string, unknown> = { ...entry.config as Record<string, unknown>, url };
  if (body.key !== undefined) config.key = body.key;
  if (body.model !== undefined) {
    if (body.model) config.model = body.model;
    else delete config.model;
  }
  if (body.models !== undefined) {
    if (body.models.length) config.managedModels = [...new Set(body.models)];
    else delete config.managedModels;
  }
  instances[instanceId] = { ...entry, displayName: body.displayName, config };
  return null;
}

export function addEndpoint(instances: InstanceConfigMap, body: AddEndpoint): { instanceId: string } | { error: string } {
  const url = endpointBaseUrl(body.url);
  if (!url) return { error: "Enter an http or https base URL without a user name, password or query string." };
  if (/^https?:\/\//i.test(body.key)) return { error: "That API key looks like a URL. Paste the secret key itself, not a web address." };
  const instanceId = `${ADDED_ENDPOINT_PREFIX}${randomUUID()}`;
  const models = [...new Set(body.models ?? [])];
  instances[instanceId] = {
    driver: "openai-compat", displayName: body.displayName, access: "api",
    config: { key: body.key, url, ...(models.length ? { managedModels: models } : {}), ...(body.catalog ? { catalog: body.catalog } : {}) },
  };
  return { instanceId };
}

export function withEndpointUrls(described: unknown, configs: InstanceConfigMap): unknown {
  if (!Array.isArray(described)) return described;
  return described.map((instance: { instanceId?: string }) => {
    const entry = instance.instanceId ? configs[instance.instanceId] : undefined;
    const url = entry && isAddedEndpoint(instance.instanceId!, entry) ? endpointDisplayUrl(entry.config) : undefined;
    if (!entry || !isAddedEndpoint(instance.instanceId!, entry)) return instance;
    const config = (entry.config ?? {}) as Record<string, unknown>;
    return { ...instance, ...(url ? { url } : {}), openaiEndpoint: {
      url: url ?? "",
      keySaved: Boolean(typeof config.key === "string" && config.key.trim()),
      model: typeof config.model === "string" ? config.model : "",
      managedModels: Array.isArray(config.managedModels) ? config.managedModels.filter((model): model is string => typeof model === "string") : [],
    } };
  });
}
