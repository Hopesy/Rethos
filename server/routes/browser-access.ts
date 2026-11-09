import type { IncomingMessage } from "node:http";
import { PASS, type RouteHandler } from "./table.ts";
import { clearSessionCookie, ownerOrAdmin } from "../request-auth.ts";
import type { SessionRegistry } from "../sessions.ts";
import { userError } from "../user-errors.ts";

export function createBrowserAccessRoutes(deps: { sessions: SessionRegistry; cookieName: string; enabled(): boolean; base(req: IncomingMessage): string | null }): RouteHandler {
  return async ({ req, res, path, method, auth, json }) => {
    if (method === "POST" && path === "/api/auth/logout") {
      if (auth.kind === "session") deps.sessions.revoke(auth.session.id);
      res.setHeader("set-cookie", clearSessionCookie(deps.cookieName));
      return json(res, 200, { ok: true });
    }
    if (method !== "POST" || path !== "/api/auth/browser-qr") return PASS;
    res.setHeader("cache-control", "no-store");
    if (!deps.enabled() || !ownerOrAdmin(auth)) return json(res, 403, userError("serverError.token.disabled"));
    if (auth.kind === "session" && !deps.sessions.isLive(auth.session.id)) return json(res, 401, userError("serverError.token.invalid"));
    const base = deps.base(req);
    if (!base) return json(res, 400, userError("serverError.token.qrAddress"));
    const parent = auth.kind === "session" ? auth.session.token ? auth.session.id : auth.session.loginTokenId : undefined;
    const opened = deps.sessions.openPairing({ scopes: [...auth.scopes], browser: true, owner: new URL(base).host, label: "Mobile browser", ttlMs: 5 * 60_000, ...(parent ? { loginTokenId: parent } : {}) });
    json(res, 200, { id: opened.id, url: `${base}/pair#signin=${opened.credential}`, expiresAt: opened.expiresAt });
  };
}
