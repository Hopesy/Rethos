import type { IncomingMessage, ServerResponse } from "node:http";
import { json, readBody } from "../harness/http.ts";
import { labelFromUserAgent, provesSameOrigin, requestOrigin, requestSource, serializeSessionCookie } from "../request-auth.ts";
import { cookieMaxAgeSeconds, type SessionRegistry } from "../sessions.ts";
import { userError } from "../user-errors.ts";

export async function tokenLoginRoute(deps: { sessions: SessionRegistry; cookieName: string; enabled: boolean }, req: IncomingMessage, res: ServerResponse, path: string, method: string): Promise<boolean> {
  if (path !== "/api/auth/token-login" || method !== "POST") return false;
  res.setHeader("cache-control", "no-store");
  if (!deps.enabled) { json(res, 403, userError("serverError.token.disabled")); return true; }
  if (!/^application\/json\b/i.test(String(req.headers["content-type"] ?? ""))) {
    json(res, 415, { error: "Send the token as JSON." }); return true;
  }
  if (!provesSameOrigin(req)) { json(res, 403, userError("serverError.token.origin")); return true; }
  const { sessions } = deps;
  const source = `token-login:${requestSource(req)}`;
  const allowed = sessions.attemptAllowed(source);
  if (!allowed.ok) {
    res.setHeader("retry-after", Math.ceil(allowed.retryAfterMs / 1000));
    json(res, 429, userError("serverError.signIn.tooMany", { seconds: Math.ceil(allowed.retryAfterMs / 1000) })); return true;
  }
  const body = await readBody(req, 4096);
  const result = sessions.loginWithToken({ token: typeof body?.token === "string" ? body.token.trim() : "", label: labelFromUserAgent(req.headers["user-agent"]) });
  if (!result) {
    sessions.noteFailure(source);
    json(res, 401, userError("serverError.token.invalid")); return true;
  }
  sessions.clearFailures(source);
  res.setHeader("set-cookie", serializeSessionCookie(deps.cookieName, result.token, { secure: requestOrigin(req)?.startsWith("https://") === true, maxAgeSeconds: cookieMaxAgeSeconds(result.session) }));
  json(res, 200, { session: result.session });
  return true;
}
