import { z } from "zod";
import { workTargetSchema } from "../../shared/work-target.ts";
import type { createWorkTargets } from "../work-targets.ts";
import type { BotRecord, Store } from "../store.ts";
import { ownerOrAdmin, type RequestAuth } from "../request-auth.ts";
import { PASS, type RouteHandler } from "./table.ts";

export function createWorkTargetRoutes(deps: {
  targets: ReturnType<typeof createWorkTargets>;
  store: Pick<Store, "bot" | "taskByThread">;
  principal(auth: RequestAuth): string | null;
  changed(bot: BotRecord): void;
}): RouteHandler {
  return async ({ path, method, url, auth, req, res, json, readBody }) => {
    const match = /^\/api\/bots\/([\w-]+)\/work-target$/.exec(path);
    if (!match || !["GET", "PATCH"].includes(method)) return PASS;
    if (!ownerOrAdmin(auth)) return json(res, 403, { error: "Computer settings require the owner" });
    const bot = deps.store.bot(match[1]!);
    if (!bot) return json(res, 404, { error: "Bot not found" });
    const person = deps.principal(auth);
    if (method === "GET") {
      const threadId = url.searchParams.get("threadId") ?? undefined;
      if (threadId && !deps.store.taskByThread(bot.id, threadId)) return json(res, 404, { error: "Conversation not found" });
      return json(res, 200, await deps.targets.status(bot, person, threadId));
    }
    const parsed = z.object({ target: workTargetSchema.nullable(), threadId: z.string().min(1).max(128).optional(), acknowledgeLocalAuto: z.boolean().optional() }).strict().safeParse(await readBody(req));
    if (!parsed.success || (parsed.data.target === null && !parsed.data.threadId)) return json(res, 400, { error: "Provide a work target and an optional conversation" });
    deps.targets.set(bot, person, parsed.data.target, parsed.data.threadId, parsed.data.acknowledgeLocalAuto);
    deps.changed(bot);
    return json(res, 200, { ok: true, ...await deps.targets.status(bot, person, parsed.data.threadId) });
  };
}
