import path from "node:path";
import { legacyWorkTarget, resolveWorkTarget, workTargetSchema, type WorkTarget, type WorkTargetOption, type WorkTargetStatus } from "../shared/work-target.ts";
import type { BotRecord, Store } from "./store.ts";
import type { SharedComputers } from "./shared-computers.ts";
import { allowsTool } from "../shared/tool-scope.ts";
import { approvalModeFor, threadApproval } from "../shared/approval-mode.ts";

export function createWorkTargets(deps: {
  store: Pick<Store, "bot" | "taskByThread" | "setBotWorkTarget" | "patchTask">;
  computers: SharedComputers;
  surfaces(bot: BotRecord): Promise<Array<{ surface: "cloud" | "vm" | "local" | "browser"; label: string; available: boolean; ready: boolean; reason?: string }>>;
}) {
  const connected = (person: string | null) => {
    const current = deps.computers.status(person);
    const known = deps.computers.known(person);
    return [...current.map(computer => ({ id: computer.id, name: computer.name, access: computer.access, ready: computer.online && computer.access !== "paused" && computer.access !== "revoked", lent: computer.access !== "revoked", platform: computer.platform ?? known.find(item => item.id === computer.id)?.platform })),
      ...known.filter(item => !current.some(computer => computer.id === item.id)).map(item => ({ ...item, ready: false }))];
  };
  return {
    async status(bot: BotRecord, person: string | null, threadId?: string, surfaces?: Awaited<ReturnType<typeof deps.surfaces>>): Promise<WorkTargetStatus> {
      const task = threadId ? deps.store.taskByThread(bot.id, threadId) : undefined;
      const options: WorkTargetOption[] = [{ target: { kind: "auto" }, label: "Auto", available: true, ready: true }];
      const selectable = surfaces ?? await deps.surfaces({ ...bot, computer: undefined });
      for (const option of selectable) {
        if (option.surface === "cloud" && bot.cloudBackend !== "vps") continue;
        options.push({ ...option, target: legacyWorkTarget({ computer: option.surface, cloudBackend: bot.cloudBackend }) });
      }
      const permitted = allowsTool(bot.toolScope, { kind: "mcp", server: "agents", name: "shared_computer" });
      options.push(...connected(person).map((computer): WorkTargetOption => ({ target: { kind: "connected" as const, computerId: computer.id }, label: computer.name,
        available: computer.lent && permitted, ready: computer.ready, state: computer.access === "paused" || computer.access === "revoked" ? computer.access : computer.ready ? "online" : "offline", ...(!computer.lent ? { reason: "Computer access was revoked" } : !permitted ? { reason: "Connected computer tools are disabled for this bot" } : !computer.ready ? { reason: "Computer is offline" } : {}) })));
      options.push({ target: { kind: "off" }, label: "Off", available: true, ready: true });
      return { defaultTarget: resolveWorkTarget(bot), ...(task?.workTarget ? { pinnedTarget: task.workTarget } : {}), selected: resolveWorkTarget(bot, task), options };
    },
    set(bot: BotRecord, person: string | null, input: unknown, threadId?: string, acknowledgeLocalAuto = false): WorkTarget | undefined {
      const parsed = input === null && threadId ? null : workTargetSchema.safeParse(input);
      if (parsed && !parsed.success) throw Object.assign(new Error("Invalid computer target"), { status: 400 });
      const target = parsed?.success ? parsed.data : undefined;
      if (threadId && !deps.store.taskByThread(bot.id, threadId)) throw Object.assign(new Error("Conversation not found"), { status: 404 });
      const task = threadId ? deps.store.taskByThread(bot.id, threadId) : undefined;
      if (target?.kind === "local" && approvalModeFor(task ? threadApproval(task, bot) : bot) === "auto" && !acknowledgeLocalAuto) {
        throw Object.assign(new Error("Confirm automatic control of this computer before selecting it."), { status: 409 });
      }
      if (target?.kind === "connected") {
        const computer = connected(person).find(item => item.id === target.computerId);
        if (!computer || !computer.lent) throw Object.assign(new Error("This computer is unavailable to the current owner"), { status: 403 });
        if (!allowsTool(bot.toolScope, { kind: "mcp", server: "agents", name: "shared_computer" })) throw Object.assign(new Error("Connected computer tools are disabled for this bot"), { status: 403 });
        if (target.cwd) {
          const paths = computer.platform === "win32" ? path.win32 : path.posix;
          if (!paths.isAbsolute(target.cwd) || target.cwd.includes("\0")) throw Object.assign(new Error("Use an absolute working folder on the selected computer"), { status: 400 });
          target.cwd = paths.normalize(target.cwd);
        }
      }
      if (threadId) deps.store.patchTask(bot.id, threadId, { workTarget: target });
      else deps.store.setBotWorkTarget(bot.id, target!);
      return target;
    },
  };
}
