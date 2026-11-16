import type { InstanceInfo } from "@/state/store";
import { isCustomOpenAiEndpoint } from "../../shared/openai-endpoint";

/** A server added from Settings → API keys → Other; matches the server's ADDED_ENDPOINT_PREFIX. */
export function isAddedServer(instance: InstanceInfo): boolean {
  return instance.driverKind === "openai-compat" && instance.instanceId.startsWith("openai-compat-");
}

export function addedServers(instances: readonly InstanceInfo[]): Array<InstanceInfo & { url?: string; managedModels?: string[] }> {
  return instances.filter((instance) => isCustomOpenAiEndpoint(instance.instanceId, instance.driverKind));
}
