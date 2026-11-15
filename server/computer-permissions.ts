import path from "node:path";
import type { ApprovalMode } from "../shared/approval-mode.ts";
import type { BotRecord } from "./store.ts";
import type { Registration, Operation, ComputerFileScope, ComputerAuthorization } from "./shared-computers.ts";
import { askForComputerAccess, COMPUTER_ACCESS_TOOL, type YourComputerBus } from "./your-computer-consent.ts";

const FILE_ACTIONS = new Set(["list_files", "read_file", "write_file", "edit_file", "append_file", "delete_file"]);
const READ_ACTIONS = new Set(["list_files", "read_file"]);
type Turn = { threadId: string; generation: string };
type Context = Turn & { bot: BotRecord; mode(): ApprovalMode; active(): boolean; language?: string };
const denied = () => new Error("The request ended or its computer permissions changed.");

export function createComputerPermissions(bus: YourComputerBus) {
  const grants = new Map<string, Array<ComputerFileScope & { computer: string }>>();
  const ownerKey = (turn: Context) => `${turn.threadId}\n${turn.bot.id}\n${turn.generation}`;
  return {
    clear(threadId: string) { for (const key of grants.keys()) if (key.startsWith(`${threadId}\n`)) grants.delete(key); },
    async authorize(registration: Registration, operation: Operation, context: Context): Promise<ComputerAuthorization> {
      if (!context.active()) throw denied();
      const files = FILE_ACTIONS.has(operation.action);
      const full = context.mode() === "full";
      const live = () => context.active() && (!full || context.mode() === "full");
      if (!files) {
        if (!full && operation.action !== "computer_tools" && operation.action !== "mcp_tools") {
          await askForComputerAccess(bus, context.bot, context, {
            tool: COMPUTER_ACCESS_TOOL,
            title: context.language?.startsWith("zh") ? `${context.bot.name} 申请使用 ${registration.name}` : `${context.bot.name} wants to use ${registration.name}`,
            subtitle: operation.action === "run_command" ? operation.command ?? "Run a command" : operation.tool_name ?? operation.action,
          });
        }
        if (!live()) throw denied();
        return { operation, active: live };
      }
      const paths = registration.platform === "win32" ? path.win32 : path.posix;
      const folder = registration.folders.find(candidate => candidate.id === operation.folder_id);
      const input = operation.path ?? "";
      if (input.includes("\0") || input.split(/[\\/]/).includes("..")) throw new Error("Use a path inside the requested directory.");
      const target = folder?.path && !paths.isAbsolute(input) ? paths.resolve(folder.path, input) : input;
      if (!paths.isAbsolute(target)) throw new Error("Use an absolute path on this computer, or a listed folder_id and relative path.");
      const resolved = paths.normalize(target);
      const write = !READ_ACTIONS.has(operation.action);
      const within = (root: string) => {
        const relative = paths.relative(root, resolved);
        return !paths.isAbsolute(relative) && relative !== ".." && !relative.startsWith(".." + paths.sep);
      };
      const key = ownerKey(context);
      const preset = registration.folders.find(candidate => candidate.path && within(candidate.path) && (!write || candidate.write));
      let scope: ComputerFileScope | undefined = full ? { root: paths.parse(resolved).root, write: true }
        : preset?.path ? { root: preset.path, write: preset.write }
          : grants.get(key)?.find(candidate => candidate.computer === registration.id && within(candidate.root) && (!write || candidate.write));
      if (!scope) {
        const root = operation.action === "list_files" ? resolved : paths.dirname(resolved);
        const chinese = context.language?.startsWith("zh");
        await askForComputerAccess(bus, context.bot, context, {
          tool: COMPUTER_ACCESS_TOOL,
          title: chinese ? `${context.bot.name} 申请${write ? "读写" : "读取"} ${registration.name} 上的目录` : `${context.bot.name} requests ${write ? "read/write" : "read"} access on ${registration.name}`,
          subtitle: `${root}\n${chinese ? "授权用于本次任务，包含此目录的子目录。" : "For this request, including subdirectories."}`,
        });
        if (!context.active()) throw denied();
        scope = { root, write };
        grants.set(key, [...grants.get(key) ?? [], { ...scope, computer: registration.id }]);
      }
      if (!live()) throw denied();
      return { operation: { ...operation, path: resolved, file_scope: { root: scope.root, write: scope.write } }, active: live };
    },
  };
}
