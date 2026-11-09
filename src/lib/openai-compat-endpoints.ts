import type { InstanceInfo } from "@/state/store";
import { isCustomOpenAiEndpoint } from "../../shared/openai-endpoint";

export function addedServers(instances: readonly InstanceInfo[]): Array<InstanceInfo & { url?: string }> {
  return instances.filter((instance) => isCustomOpenAiEndpoint(instance.instanceId, instance.driverKind));
}
