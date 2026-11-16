import { z } from "zod";

export const RETIRED_DESKTOP_MESSAGE = "The commercial desktop service was removed. Review the bot's work location before enabling this routine again.";

/** The computer resource used by a bot or pinned conversation. Connected paths belong to that computer. */
export const workTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("auto") }).strict(),
  z.object({ kind: z.literal("off") }).strict(),
  z.object({ kind: z.literal("browser") }).strict(),
  z.object({ kind: z.literal("local") }).strict(),
  z.object({ kind: z.literal("private"), backend: z.enum(["vm", "vps"]) }).strict(),
  z.object({ kind: z.literal("connected"), computerId: z.string().uuid(), cwd: z.string().min(1).max(2048).optional() }).strict(),
]);
export type WorkTarget = z.infer<typeof workTargetSchema>;
export interface WorkTargetOwner { workTarget?: WorkTarget }
export interface WorkTargetOption {
  target: WorkTarget;
  label: string;
  available: boolean;
  ready: boolean;
  reason?: string;
  state?: "online" | "offline" | "paused" | "revoked";
}
export interface WorkTargetStatus {
  defaultTarget: WorkTarget;
  pinnedTarget?: WorkTarget;
  selected: WorkTarget;
  options: WorkTargetOption[];
}
export type WorkTargetFields = { workTarget?: WorkTarget; computer?: "cloud" | "vm" | "local" | "browser" | "off"; cloudBackend?: "box" | "vps" };
export type TaskTargetFields = { workTarget?: WorkTarget; surface?: "cloud" | "vm" | "local" | "browser"; surfaceSource?: "user" | "auto"; surfaceAuto?: true };

export function legacyWorkTarget(fields: Omit<WorkTargetFields, "workTarget">): WorkTarget {
  switch (fields.computer) {
    case "cloud": return fields.cloudBackend === "vps" ? { kind: "private", backend: "vps" } : { kind: "auto" };
    case "vm": return { kind: "private", backend: "vm" };
    case "local": case "browser": case "off": return { kind: fields.computer };
    default: return { kind: "auto" };
  }
}

export function resolveWorkTarget(bot: WorkTargetFields, task?: TaskTargetFields | null): WorkTarget {
  const target = bot.workTarget ?? legacyWorkTarget(bot);
  if (target.kind === "off" || bot.computer === "off") return { kind: "off" };
  if (task?.workTarget) return task.workTarget;
  if (task?.surface && task.surfaceSource !== "auto" && !task.surfaceAuto) return legacyWorkTarget({ computer: task.surface, cloudBackend: bot.cloudBackend });
  return target;
}

export function workTargetLegacyFields(target: WorkTarget): Pick<WorkTargetFields, "computer" | "cloudBackend"> {
  if (target.kind === "private") return target.backend === "vps" ? { computer: "cloud", cloudBackend: "vps" } : { computer: "vm" };
  return { computer: target.kind === "auto" || target.kind === "connected" ? undefined : target.kind };
}

export function workTargetKey(target: WorkTarget): string {
  return target.kind === "connected" ? `connected:${target.computerId}:${target.cwd ?? ""}` : target.kind === "private" ? `private:${target.backend}` : target.kind;
}

export function connectedTargetRefusal(target: WorkTarget | undefined, computerId: string): string | null {
  if (target?.kind === "off") return "Computer access is off for this conversation.";
  if (target?.kind === "connected" && target.computerId !== computerId) return "Use the computer selected for this conversation.";
  return null;
}

export function botWorkTargetPatch(current: WorkTargetFields, patch: WorkTargetFields): WorkTargetFields {
  if (Object.hasOwn(patch, "workTarget")) {
    const workTarget = patch.workTarget === undefined ? { kind: "auto" as const } : workTargetSchema.parse(patch.workTarget);
    return { ...patch, ...workTargetLegacyFields(workTarget), workTarget };
  }
  if (Object.hasOwn(patch, "computer") || (Object.hasOwn(patch, "cloudBackend") && current.computer === "cloud")) {
    const workTarget = legacyWorkTarget({ ...current, ...patch });
    return { ...patch, ...workTargetLegacyFields(workTarget), workTarget };
  }
  return patch;
}

export function taskWorkTargetPatch(bot: WorkTargetFields, patch: TaskTargetFields): TaskTargetFields {
  if (Object.hasOwn(patch, "workTarget")) {
    const workTarget = patch.workTarget && workTargetSchema.parse(patch.workTarget);
    const computer = workTarget && workTargetLegacyFields(workTarget).computer;
    return { ...patch, workTarget, surface: computer === "off" ? undefined : computer, surfaceSource: workTarget ? patch.surfaceSource ?? "user" : undefined };
  }
  if (Object.hasOwn(patch, "surface")) return { ...patch, workTarget: patch.surface && patch.surfaceSource !== "auto" ? legacyWorkTarget({ ...bot, computer: patch.surface }) : undefined };
  return patch;
}

export function automaticWorkTargetsToClear(bot: WorkTargetFields & { tasks?: TaskTargetFields[] }, target: WorkTarget): TaskTargetFields[] {
  if (target.kind === "auto") return [];
  return (bot.tasks ?? []).filter(task => {
    if (task.surfaceSource !== "auto") return false;
    const pinned = task.workTarget ?? (task.surface && legacyWorkTarget({ computer: task.surface, cloudBackend: bot.cloudBackend }));
    return Boolean(pinned && workTargetKey(pinned) !== workTargetKey(target));
  });
}

/** Upgrade only persisted legacy hosted targets; operational preferences and private paths retain their existing owners. */
export function migrateWorkTargets(bot: WorkTargetFields & { tasks?: TaskTargetFields[] }): boolean {
  let changed = false;
  if (bot.workTarget && !workTargetSchema.safeParse(bot.workTarget).success) { delete bot.workTarget; changed = true; }
  if (bot.computer === "cloud" && bot.cloudBackend !== "vps") {
    Object.assign(bot, { computer: undefined, workTarget: { kind: "auto" } }); changed = true;
  }
  if (bot.cloudBackend === "box") { delete bot.cloudBackend; changed = true; }
  for (const task of bot.tasks ?? []) {
    if (task.workTarget && !workTargetSchema.safeParse(task.workTarget).success) { delete task.workTarget; changed = true; }
    if (task.surface === "cloud" && bot.cloudBackend !== "vps") {
      Object.assign(task, { surface: undefined, surfaceSource: undefined, workTarget: undefined }); changed = true;
    }
  }
  return changed;
}
