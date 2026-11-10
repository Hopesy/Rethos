import { createServer, type Server } from "node:http";
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from "node:fs";
import { resolve, join } from "node:path";
import { afterEach, beforeEach, expect, it } from "vitest";
import { SessionRegistry, SESSION_TTL_MS } from "./sessions.ts";
import { tokenLoginRoute } from "./routes/token-login.ts";
import { createBrowserAccessRoutes } from "./routes/browser-access.ts";
import { resolveRequestAuth } from "./request-auth.ts";
import { json, readBody } from "./harness/http.ts";

const temp = resolve(".Rethos-temp/token-login/unit");
let dir: string, registry: SessionRegistry, server: Server, url: string, now: number, enabled: boolean;
beforeEach(async () => {
  mkdirSync(temp, { recursive: true }); dir = mkdtempSync(join(temp, "test-")); now = Date.now(); enabled = true;
  registry = new SessionRegistry({ file: join(dir, "sessions.json"), now: () => now });
  const qr = createBrowserAccessRoutes({ sessions: registry, cookieName: "fixture", enabled: () => enabled, base: () => url });
  server = createServer(async (req, res) => {
    try {
      const parsed = new URL(req.url!, url), path = parsed.pathname, method = req.method!;
      if (await tokenLoginRoute({ sessions: registry, cookieName: "fixture", enabled }, req, res, path, method)) return;
      const gate = resolveRequestAuth(req, { sessions: registry, cookieName: "fixture", url: parsed, loopbackTrust: "service", streamPath: "/api/stream" });
      if (!gate.auth) { json(res, gate.status, { error: gate.error }); return; }
      if (path === "/api/auth/browser-qr" || path === "/api/auth/logout") { await qr({ req, res, url: parsed, path, method, auth: gate.auth, json, readBody }); return; }
      json(res, 200, { ok: true, id: gate.auth.kind === "session" ? gate.auth.session.id : null });
    } catch (error) { json(res, Number((error as { status?: number }).status) || 500, { error: "Request failed" }); }
  });
  await new Promise<void>(ready => server.listen(0, "127.0.0.1", ready));
  url = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});
afterEach(async () => {
  server?.closeAllConnections(); await new Promise<void>(done => server ? server.close(() => done()) : done());
  registry?.close(); if (dir.startsWith(temp + "\\") || dir.startsWith(temp + "/")) rmSync(dir, { recursive: true, force: true });
});
const mint = (scopes: Array<"admin" | "client"> = ["admin", "client"], ttl = 90 * 86400_000) => {
  const grant = registry.openPairing({ scopes, tokenTtlMs: ttl });
  const result = registry.exchange({ code: grant.credential, label: "Fixture token", source: "fixture" });
  if (!result.ok) throw new Error(result.error); return result;
};
const signIn = (token: string, headers: Record<string, string> = {}) => fetch(url + "/api/auth/token-login", { method: "POST", headers: { origin: url, "content-type": "application/json", ...headers }, body: JSON.stringify({ token }) });
const cookieOf = (response: Response) => response.headers.get("set-cookie")!.split(";")[0];

it("one reusable token signs in two browsers with independent cookies and no token in either response", async () => {
  const root = mint(); const a = await signIn(root.token), b = await signIn(root.token);
  expect(a.status).toBe(200); expect(b.status).toBe(200);
  const ac = cookieOf(a), bc = cookieOf(b); expect(ac).not.toBe(bc); expect(ac).not.toContain(root.token);
  expect(a.headers.get("set-cookie")).toMatch(/HttpOnly; SameSite=Lax; Max-Age=/);
  expect(JSON.stringify(await a.json())).not.toContain("omb_sess_");
  expect((await fetch(url + "/private", { headers: { cookie: ac } })).status).toBe(200);
  const logout = await fetch(url + "/api/auth/logout", { method: "POST", headers: { cookie: ac, origin: url } });
  expect(logout.status).toBe(200); expect(logout.headers.get("set-cookie")).toContain("Max-Age=0");
  expect((await fetch(url + "/private", { headers: { cookie: ac } })).status).toBe(401);
  expect((await fetch(url + "/private", { headers: { cookie: bc } })).status).toBe(200);
  expect((await signIn(root.token)).status).toBe(200);
  expect(readFileSync(join(dir, "sessions.json"), "utf8")).not.toContain(root.token);
});

it("token revocation closes all derived sessions and their stream tickets", async () => {
  const root = mint(); const a = registry.loginWithToken({ token: root.token, label: "A" })!, b = registry.loginWithToken({ token: root.token, label: "B" })!;
  const ticket = registry.issueStreamTicket(a.session.id), closed: string[] = [];
  registry.onSessionRevoked(id => closed.push(id)); registry.revoke(root.session.id);
  expect(closed).toEqual(expect.arrayContaining([root.session.id, a.session.id, b.session.id]));
  expect(registry.authenticate(a.token)).toBeNull(); expect(registry.isLive(b.session.id)).toBe(false);
  expect(registry.redeemStreamTicket(ticket.ticket)).toBeNull(); expect((await signIn(root.token)).status).toBe(401);
});

it("a saved browser session survives restart and renewal stays within its token's expiry", () => {
  const root = mint(undefined, 40 * 86400_000), signed = registry.loginWithToken({ token: root.token, label: "Browser" })!;
  registry.close(); registry = new SessionRegistry({ file: join(dir, "sessions.json"), now: () => now });
  expect(registry.authenticate(signed.token)?.loginTokenId).toBe(root.session.id);
  now += 20 * 86400_000; expect(registry.renew(signed.session.id)).toBe(true);
  expect(registry.authenticate(signed.token)!.expiresAt).toBe(root.session.expiresAt);
  now = root.session.expiresAt; expect(registry.authenticate(signed.token)).toBeNull(); expect(registry.isLive(signed.session.id)).toBe(false);
});

it("ordinary device and cookie credentials cannot act as reusable login tokens", async () => {
  const paired = registry.openPairing(); const normal = registry.exchange({ code: paired.code, label: "Ordinary", source: "fixture" });
  if (!normal.ok) throw new Error(normal.error);
  expect((await signIn(normal.token)).status).toBe(401);
  const root = mint(), signed = registry.loginWithToken({ token: root.token, label: "Browser" })!;
  expect((await signIn(signed.token)).status).toBe(401);
  expect((await fetch(url + "/private", { headers: { authorization: `Bearer ${signed.token}` } })).status).toBe(401);
});

it("preserves client scope and refuses token creation and QR access to a client session", async () => {
  const root = mint(["client"]), response = await signIn(root.token), cookie = cookieOf(response);
  expect(response.status).toBe(200); expect((await response.json() as { session: { scopes: string[] } }).session.scopes).toEqual(["client"]);
  expect((await fetch(url + "/api/auth/browser-qr", { method: "POST", headers: { cookie, origin: url } })).status).toBe(403);
});

it("refuses cross-site login, non-JSON, oversized bodies and disabled deployments", async () => {
  const root = mint();
  expect((await signIn(root.token, { origin: "https://elsewhere.test" })).status).toBe(403);
  expect((await signIn(root.token, { origin: "null" })).status).toBe(403);
  expect((await signIn(root.token, { "content-type": "text/plain" })).status).toBe(415);
  expect((await signIn("x".repeat(5000))).status).toBe(413);
  enabled = false; expect((await signIn(root.token)).status).toBe(403);
});

it("limits repeated failures and allows another attempt after the cooldown", async () => {
  for (let i = 0; i < 10; i++) expect((await signIn("invalid")).status).toBe(401);
  const root = mint(), limited = await signIn(root.token); expect(limited.status).toBe(429); expect(limited.headers.get("retry-after")).toBeTruthy();
  now += 60_001; expect((await signIn(root.token)).status).toBe(200);
});

it("QR grants inherit the login token, expire after five minutes and redeem once into a browser cookie", async () => {
  const root = mint(), signed = await signIn(root.token);
  const response = await fetch(url + "/api/auth/browser-qr", { method: "POST", headers: { cookie: cookieOf(signed), origin: url } });
  expect(response.status).toBe(200); const offer = await response.json() as { url: string; expiresAt: number };
  expect(offer.url).not.toContain(root.token); expect(offer.expiresAt - now).toBe(5 * 60_000);
  expect(new URL(offer.url).pathname).toBe("/pair");
  const credential = new URLSearchParams(new URL(offer.url).hash.slice(1)).get("signin")!;
  expect(registry.previewBrowserSignIn(credential)).toBeTruthy();
  const phone = registry.exchange({ code: credential, label: "Phone", source: "phone", browser: true });
  if (!phone.ok) throw new Error(phone.error);
  expect(registry.authenticate(phone.token)?.cookieOnly).toBe(true);
  expect(registry.authenticate(phone.token)?.loginTokenId).toBe(root.session.id);
  expect(registry.exchange({ code: credential, label: "Other", source: "other", browser: true }).ok).toBe(false);
  registry.revoke(root.session.id); expect(registry.isLive(phone.session.id)).toBe(false);
});

it("unused QR grants are cancelled when the parent token is revoked or the grant expires", () => {
  const root = mint();
  const grant = registry.openPairing({ browser: true, loginTokenId: root.session.id, ttlMs: 5 * 60_000 });
  registry.revoke(root.session.id); expect(registry.previewBrowserSignIn(grant.credential)).toBeNull();
  const other = registry.openPairing({ browser: true, ttlMs: 5 * 60_000 }); now += 5 * 60_000;
  expect(registry.previewBrowserSignIn(other.credential)).toBeNull();
  expect(SESSION_TTL_MS).toBeGreaterThan(5 * 60_000);
});
