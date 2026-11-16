import { randomBytes } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, renameSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createLoginHandoffClient, type ConnectionAsk } from "../../electron/cloud-logins.mjs";
import { createCloudSend, type CloudMoveCheck, type CloudSendOutcome, type CloudSendSnapshot } from "../../electron/cloud-send.mjs";
import { installCloudSend, openOwnerSession } from "../../electron/cloud-send-main.mjs";
import { BACKGROUND_HEADERS } from "../../electron/cloud-power.mjs";
import { cloudPairingSignature, cloudRequestSignature } from "../../server/cloud-home.ts";
import type { TeamMember } from "../../server/cloud-team.ts";
import { removeTempDir, waitForExit } from "../../server/testing/cleanup.ts";
import { freePortBlock } from "../../server/testing/ports.ts";

const SERVER_DIR = fileURLToPath(new URL("../../server/", import.meta.url));
export const CLOUD_HOST = "omb-t-5e6d7c8b9a0f.fly.dev";
const CLOUD_MACHINE_ID = "7c1d2e3f-4a5b-4c6d-8e7f-9a0b1c2d3e4f";
const EDGE = { host: CLOUD_HOST, "x-forwarded-for": "203.0.113.9", "x-forwarded-proto": "https", origin: `https://${CLOUD_HOST}` };
const parse = (text: string) => { try { return JSON.parse(text); } catch { return null; } };

export interface CloudSendFixture {
  root: string;
  desktopBase: string;
  cloudBase: string;
  /** The owner's own device on My Cloud, through the edge: what the window's Cloud session is. */
  owner: string;
  ownerCapability: string;
  /** What the Admin signs with and My Cloud reports with, and the machine id My Cloud reports as. */
  secret: string;
  cloudMachineId: string;
  edge: typeof EDGE;
  /** Every answer either server gave, for the no-secret check. */
  answers: string[];
  logs(): string;
  local(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  onCloud(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  /** A picture on this computer's server, as an avatarUrl. */
  picture(bytes: Uint8Array): Promise<string>;
  /** Main's IPC handlers, as this computer's page (or My Cloud's, with page "cloud") calls them. */
  call<T>(channel: string, page: "local" | "cloud", ...args: unknown[]): Promise<T>;
  /** The labels of the sessions each send made on My Cloud, as main asked for them. */
  labels: string[];
  /** The Admin's one-time code for this Cloud, as pairHome() gives it. */
  grant(label: string): Promise<{ origin: string; code: string; expiresAt: number }>;
  /** What an older desktop's Send everything did, over the same cloud-send.json: the app is then opened again, as an
   * update after it would. */
  olderSend(input?: { keys?: string[]; force?: string[] }): Promise<CloudSendOutcome>;
  /** An older desktop's comparison of both sides. */
  olderCompare(): Promise<CloudSendSnapshot>;
  /** A pass of the one-time move, through main's own wiring; `final`: the one after this computer stopped. */
  move(options?: { final?: boolean }): Promise<CloudSendOutcome>;
  /** The move's check of what arrived, through main's own wiring. */
  check(): Promise<CloudMoveCheck>;
  /** The labels of the sessions each send made, and whether each counted as someone using My Cloud. */
  sessions: Array<{ label: string; background: boolean }>;
  /** Each request main sent My Cloud's chats route: the rows of each conversation it carried. */
  chatRequests: Array<Array<{ threadId: string; rows: number }>>;
  /** With `broker`: this computer's installation on the connected-apps service. */
  desktopInstallation: { id: string; token: string; userId: string } | null;
  /** This computer's server's private port, asked as main asks it (cloud-logins.mjs). */
  handoff(what: ConnectionAsk): Promise<any>;
  /** An answer of its own for a request main sends My Cloud, in place of My Cloud's: a network that fails, say. */
  intercept: ((url: string, init: RequestInit) => Response | null) | null;
  /** The app quits or is killed: its main wiring stops, this computer's server is killed, and both start again on the
   * same data. With `cloud`, My Cloud's server is started again too, with more of its environment. With `dataDir`, this
   * computer's server starts on that folder instead, at the same address, as main's swap to a profile does. */
  relaunch(options?: { kill?: boolean; cloud?: NodeJS.ProcessEnv; dataDir?: string }): Promise<void>;
  /** This computer's own data folder: the copy the move freezes. */
  desktopDataDir: string;
  /** The Team Cloud started with `team` (docs/team-cloud.md), paired the way the Admin pairs it: a signed body with
   * the member claim, redeemed at /api/auth/pair. Null without `team`. */
  team: CloudTeamFixture | null;
  close(): Promise<void>;
}

export interface CloudTeamFixture {
  base: string;
  home: string;
  id: string;
  name: string;
  /** What the Admin signs with and this Cloud reports with, and the machine id it reports as. */
  secret: string;
  machineId: string;
  /** The Admin's signed pairing for one member, as the Admin hands it to the app: a one-time code, not redeemed. */
  grant(member: TeamMember): Promise<{ origin: string; code: string; expiresAt: number }>;
  /** The Admin's signed pairing for one member, redeemed into a bearer. `body` replaces the member and team claims
   * (a forged or missing claim); `secret` signs with another key (a forgery). The first owner or admin to pair also gives
   * the team's Chief a fixed name, "Seedling". */
  pair(member: TeamMember | null, options?: { body?: Record<string, unknown>; secret?: string; label?: string }): Promise<{ status: number; body: any; token: string | null }>;
  /** A request as one person, by their bearer. */
  as(token: string, method: string, path: string, body?: unknown, headers?: Record<string, string>): Promise<{ status: number; body: any }>;
  /** The Admin's signed power request (the sleep handshake). */
  signed(method: string, path: string, body?: unknown): Promise<{ status: number; body: any }>;
  /** A turn's own bearer for the internal routes, as the harness gives a bot's tools. */
  capability(botId: string, threadId: string, kind?: string): Promise<string>;
  /** The server stopped and started again on the same data (a deploy). */
  relaunch(env?: NodeJS.ProcessEnv): Promise<void>;
}

const TEAM_MACHINE_ID = "0d9e8f7a-6b5c-4d3e-9f8a-7b6c5d4e3f2a";

function fakeOnePassword(at: string, token: string): string {
  const sdk = join(at, "node_modules", "@1password", "sdk");
  mkdirSync(sdk, { recursive: true });
  writeFileSync(join(sdk, "package.json"), JSON.stringify({ name: "@1password/sdk", version: "0.5.0", main: "index.js" }));
  writeFileSync(join(sdk, "index.js"), `"use strict";
exports.createClient = async ({ auth }) => {
  if (auth !== ${JSON.stringify(token)}) throw new Error("error authenticating: invalid service account token");
  return {
    vaults: { list: async () => [{ id: "v1", title: "Shared with Rethos" }] },
    items: { list: async () => [], getAll: async () => ({ individualResponses: [] }) },
  };
};
`);
  return at;
}

/** `cloudOnePasswordToken`: the token My Cloud's 1Password accepts (default: this computer's), so a test can make 1Password
 * refuse this computer's token on My Cloud. `toolCalls`: each turn on this computer makes that many tool calls first, so a
 * few turns make a conversation of several pages. `broker`: the connected-apps service both servers use, this computer
 * with an installation of its own as the desktop app registers one, My Cloud registering itself as a Cloud home does.
 * `env`: more of both servers' environment. `cloudEngine`: lines run at the start of My Cloud's synthetic Claude CLI, to
 * script its turns (fake-claude-cli.ts). */
export async function launchCloudSendFixture({ onePasswordToken, cloudOnePasswordToken = onePasswordToken, toolCalls = 0, broker, env = {}, cloudEnv = {}, cloudEngine = "", desktopEngine = "", space, cloudSignedIn = true, team }: {
  onePasswordToken: string; cloudOnePasswordToken?: string; toolCalls?: number;
  /** A Team Cloud too (OMB_CLOUD_ROLE=team), with its own environment and synthetic Claude CLI lines. */
  team?: { id: string; name: string; env?: NodeJS.ProcessEnv; engine?: string; noAi?: boolean;
    /** Scopes of this checkout's node_modules (`@duckdb`) linked into the Team Cloud's native tree before it starts: the
     * server can load DuckDB at its first config broadcast, and a failed load stays failed for the server's life. */
    native?: string[] };
  broker?: { url: string; install(): Promise<{ id: string; token: string; userId: string }> };
  env?: NodeJS.ProcessEnv;
  /** My Cloud's own environment only (a store limit, say). */
  cloudEnv?: NodeJS.ProcessEnv;
  cloudEngine?: string;
  /** The same for this computer's synthetic Claude CLI. */
  desktopEngine?: string;
  /** My Cloud's plan disk and the Admin's grow, as main gives them to a move. */
  space?: { disk(): unknown; grow(sizeGb: number): Promise<unknown> };
  /** False: My Cloud's own Claude is signed out, as on a new Cloud. */
  cloudSignedIn?: boolean;
}): Promise<CloudSendFixture> {
  const root = mkdtempSync(join(tmpdir(), "omb-cloud-send-"));
  const secret = randomBytes(32).toString("base64url");
  const ownerCapability = randomBytes(32).toString("base64url");
  const answers: string[] = [];
  const labels: string[] = [];
  let logs = "";
  const children = new Set<ChildProcess>();
  const remember = async (response: Response) => { answers.push(await response.clone().text()); return response; };

  async function start(name: string, own: NodeJS.ProcessEnv, port: number, extra: string[] = [], ipc = false, acceptedToken = onePasswordToken, calls = 0, engine = "", signedIn = true): Promise<ChildProcess> {
    const home = join(root, name);
    const dataDir = join(home, ".openmausbot");
    mkdirSync(dataDir, { recursive: true });
    const cli = join(home, "fixture-claude.mjs");
    const tools = calls ? JSON.stringify(Array.from({ length: calls }, (_, i) => ({ name: "Bash", input: { command: `echo step ${i}` } }))) : "";
    writeFileSync(cli, `#!/usr/bin/env node
if (process.argv[2] === "auth") { console.log(JSON.stringify(${signedIn ? '{ loggedIn: true, email: "person@example.test" }' : '{ loggedIn: false, authMethod: "none" }'})); process.exit(0); }
process.env.FAKE_CLAUDE_VERSION = "2.1.284";
process.env.FAKE_CLAUDE_FIXTURE_DIR = ${JSON.stringify(home)};
${tools ? `process.env.FAKE_CLAUDE_TOOL_CALLS = ${JSON.stringify(tools)};` : ""}
${engine}
await import(${JSON.stringify(pathToFileURL(join(SERVER_DIR, "testing", "fake-claude-cli.ts")).href)});
`, { mode: 0o755 });
    if (!existsSync(join(dataDir, "config.json"))) writeFileSync(join(dataDir, "config.json"), JSON.stringify({ instances: {
      ...Object.fromEntries(["codex", "cursor", "githubCopilot", "openaiCompat", "qwen", "hermes", "pi", "grok"].map((id) => [id, { driver: "not-a-real-driver" }])),
      claude: { driver: "claudeAgent", displayName: "Claude", config: { cli } },
    } }));
    const offline = `data:text/javascript,${encodeURIComponent('const real = globalThis.fetch; const admin = process.env.FIXTURE_ADMIN_STAND_IN; globalThis.fetch = async (url, init) => admin && String(url).startsWith("https://cloud.example.test/") ? real(admin + String(url).slice(26), init) : String(url).startsWith("http://127.0.0.1:") ? real(url, init) : new Response("offline fixture", { status: 503 });')}`;
    const child = spawn(process.execPath, ["--import", offline, ...extra, join(SERVER_DIR, "index.ts")], {
      cwd: join(SERVER_DIR, ".."),
      env: { PATH: process.env.PATH, ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}), HOME: home, USERPROFILE: home, OMB_DATA_DIR: dataDir,
        OMB_PORT: String(port), OMB_WEBHOOK_PORT: String(port + 1), OMB_BOT_BOX: "0", OMB_DUCKDB_DIR: fakeOnePassword(join(home, "native"), acceptedToken), ...env, ...own },
      stdio: ["ignore", "pipe", "pipe", ...(ipc ? ["ipc" as const] : [])],
    });
    children.add(child);
    child.on("close", () => children.delete(child));
    child.stdout?.on("data", (chunk) => { logs += chunk; });
    child.stderr?.on("data", (chunk) => { logs += chunk; });
    const deadline = Date.now() + 30_000;
    for (;;) {
      if (child.exitCode !== null) throw new Error(`${name} exited:\n${logs}`);
      try { if ((await fetch(`http://127.0.0.1:${port}/api/health`)).ok) return child; } catch {}
      if (Date.now() > deadline) throw new Error(`${name} did not start:\n${logs}`);
      await new Promise((resolve) => setTimeout(resolve, 100));
    }
  }

  const parentPort = `data:text/javascript,${encodeURIComponent(`
    const listeners = [];
    Object.defineProperty(process, "parentPort", { value: {
      on(event, listener) { if (event === "message") listeners.push(listener); },
      postMessage(message) { process.send?.(message); },
    } });
    process.on("message", (data) => { for (const listener of listeners) listener({ data }); });
    process.channel?.unref();
  `)}`;
  const desktopPort = await freePortBlock([0, 1]);
  const desktopBase = `http://127.0.0.1:${desktopPort}`;
  const desktopInstallation = broker ? await broker.install() : null;
  const startDesktop = async (dataDir?: string) => {
    const child = await start("desktop", { OMB_DESKTOP_PARENT: "1", ...(dataDir ? { OMB_DATA_DIR: dataDir } : {}),
      ...(broker && desktopInstallation ? { OMB_COMPOSIO_BROKER_URL: broker.url, OMB_COMPOSIO_BROKER_TOKEN: desktopInstallation.token } : {}) }, desktopPort, ["--import", parentPort], true, onePasswordToken, toolCalls, desktopEngine);
    child.send({ type: "openmausbot:desktop-mutation-token", token: ownerCapability });
    return child;
  };
  let desktop = await startDesktop();
  const cloudPort = await freePortBlock([0, 1]);
  const cloudBase = `http://127.0.0.1:${cloudPort}`;
  const startCloud = (more: NodeJS.ProcessEnv = {}) => start("cloud", { OMB_CLOUD_ROLE: "home", OMB_CLOUD_MACHINE_ID: CLOUD_MACHINE_ID, OMB_CLOUD_ADMIN_URL: "https://cloud.example.test",
    OMB_CLOUD_BOOTSTRAP_SECRET: secret, OMB_PUBLIC_URL: `https://${CLOUD_HOST}`, ...(broker ? { OMB_COMPOSIO_BROKER_URL: broker.url } : {}), ...cloudEnv, ...more }, cloudPort, [], false, cloudOnePasswordToken, 0, cloudEngine, cloudSignedIn);
  let cloud = await startCloud();

  const mintCode = async (label: string) => {
    const body = JSON.stringify({ label, ttlSeconds: 300 });
    const timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(16).toString("base64url");
    const response = await fetch(`${cloudBase}/api/cloud/pairing`, { method: "POST", headers: { ...EDGE, "content-type": "application/json",
      "x-omb-cloud-timestamp": timestamp, "x-omb-cloud-nonce": nonce, "x-omb-cloud-signature": `v1=${cloudPairingSignature(secret, timestamp, nonce, body)}` }, body });
    // A Cloud that turns the request away says why, instead of handing main a code that is not there.
    if (!response.ok) throw new Error(`My Cloud gave no one-time code: HTTP ${response.status} ${await response.text()}`);
    return ((await response.json()) as { code: string }).code;
  };
  const pairOwner = async () => {
    const paired = await fetch(`${cloudBase}/api/auth/pair`, { method: "POST", headers: { ...EDGE, "content-type": "application/json" }, body: JSON.stringify({ code: await mintCode("Rethos app (Cloud)") }) });
    return ((await paired.json()) as { token: string }).token;
  };
  let owner = await pairOwner();
  const signedRequest = async (base: string, method: string, path: string, body: string) => {
    const timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(16).toString("base64url");
    const init: RequestInit = { method, headers: { ...EDGE, ...(body ? { "content-type": "application/json" } : {}),
      "x-omb-cloud-timestamp": timestamp, "x-omb-cloud-nonce": nonce, "x-omb-cloud-signature": `v1=${cloudRequestSignature(secret, timestamp, nonce, method, path, body)}` } };
    if (body) init.body = body;
    const response = await remember(await fetch(`${base}${path}`, init));
    return { status: response.status, body: parse(await response.text()) };
  };
  const CAPABILITY_KEY = randomBytes(16).toString("hex");
  let teamFixture: CloudTeamFixture | null = null;
  if (team) {
    const teamPort = await freePortBlock([0, 1]);
    const teamBase = `http://127.0.0.1:${teamPort}`;
    // Windows' child.kill("SIGTERM") ends a process at once, without Node's signal handlers, so the server never closes
    // its session registry and its next start drops every member's session, as after a crash. There the team server is
    // asked to stop over IPC and runs its own SIGTERM shutdown (as server/acp-shutdown.e2e.test.ts does).
    const stopOverIpc = process.platform === "win32";
    const stopOnMessage = `data:text/javascript,${encodeURIComponent('process.on("message", (message) => { if (message === "stop") process.emit("SIGTERM"); }); process.channel?.unref();')}`;
    if (team.noAi) {
      mkdirSync(join(root, "team", ".openmausbot"), { recursive: true });
      writeFileSync(join(root, "team", ".openmausbot", "config.json"), JSON.stringify({ instances: Object.fromEntries(["claude", "codex", "cursor", "githubCopilot", "openaiCompat", "qwen", "hermes", "pi", "grok"].map((id) => [id, { driver: "not-a-real-driver" }])) }));
    }
    for (const scope of team.native ?? []) {
      mkdirSync(join(root, "team", "native", "node_modules"), { recursive: true });
      symlinkSync(join(SERVER_DIR, "..", "node_modules", scope), join(root, "team", "native", "node_modules", scope), "junction");
    }
    const startTeam = (more: NodeJS.ProcessEnv = {}) => start("team", { OMB_CLOUD_ROLE: "team", OMB_CLOUD_TEAM_ID: team.id, OMB_CLOUD_TEAM_NAME: team.name,
      OMB_CLOUD_MACHINE_ID: TEAM_MACHINE_ID, OMB_CLOUD_ADMIN_URL: "https://cloud.example.test", OMB_CLOUD_BOOTSTRAP_SECRET: secret,
      OMB_PUBLIC_URL: `https://${CLOUD_HOST}`, OMB_TEST_INTERNAL_CAPABILITY_KEY: CAPABILITY_KEY, ...(broker ? { OMB_COMPOSIO_BROKER_URL: broker.url } : {}), ...team.env, ...more },
      teamPort, stopOverIpc ? ["--import", stopOnMessage] : [], stopOverIpc, onePasswordToken, 0, team.engine ?? "", true);
    let teamServer = await startTeam();
    const teamFetch = (path: string, init: RequestInit) => fetch(`${teamBase}${path}`, init).catch(async (error: unknown) => {
      await new Promise((resolve) => setTimeout(resolve, 500));
      const state = teamServer.exitCode === null && teamServer.signalCode === null ? "is still running" : `exited (${teamServer.exitCode ?? teamServer.signalCode})`;
      throw new Error(`${init.method ?? "GET"} ${path} on the Team Cloud got no answer, and the Team Cloud ${state}. The servers' output:\n${logs.slice(-8_000)}`, { cause: error });
    });
    const as: CloudTeamFixture["as"] = async (token, method, path, body, headers = {}) => {
      const init: RequestInit = { method, headers: { ...EDGE, authorization: `Bearer ${token}`, ...headers,
        ...(body === undefined || body instanceof Uint8Array ? {} : { "content-type": "application/json" }) } };
      if (body !== undefined) init.body = body instanceof Uint8Array ? body : JSON.stringify(body);
      const response = await remember(await teamFetch(path, init));
      return { status: response.status, body: parse(await response.text()) };
    };
    // A new Team Cloud's Chief gets a name at random, so one run in 64 it would share a name with a bot the test makes.
    let chiefNamed = false;
    const nameChief = async (token: string) => {
      const listed = await as(token, "GET", "/api/bots?messages=0");
      const chief = (listed.body.bots as Array<{ id: string; chiefOfStaff?: boolean }>).find((bot) => bot.chiefOfStaff);
      if (!chief) return;
      const renamed = await as(token, "PATCH", `/api/bots/${chief.id}`, { name: "Seedling" });
      if (renamed.status !== 200) throw new Error(`could not name the team's Chief: ${renamed.status} ${JSON.stringify(renamed.body)}`);
    };
    teamFixture = {
      base: teamBase, home: join(root, "team"), id: team.id, name: team.name, secret, machineId: TEAM_MACHINE_ID,
      async grant(member) {
        const body = JSON.stringify({ label: "Rethos app (Team Cloud)", ttlSeconds: 300, team: { id: team.id, name: team.name }, member });
        const timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(16).toString("base64url");
        const minted = await fetch(`${teamBase}/api/cloud/pairing`, { method: "POST", headers: { ...EDGE, "content-type": "application/json",
          "x-omb-cloud-timestamp": timestamp, "x-omb-cloud-nonce": nonce, "x-omb-cloud-signature": `v1=${cloudPairingSignature(secret, timestamp, nonce, body)}` }, body });
        if (minted.status !== 200) throw Object.assign(new Error(`team pairing ${minted.status}`), { status: minted.status });
        return { origin: teamBase, code: ((await minted.json()) as { code: string }).code, expiresAt: Date.now() + 300_000 };
      },
      async pair(member, options = {}) {
        const claims = options.body ?? { team: { id: team.id, name: team.name }, ...(member ? { member } : {}) };
        const body = JSON.stringify({ label: options.label ?? "Rethos app (Team Cloud)", ttlSeconds: 300, ...claims });
        const timestamp = String(Math.floor(Date.now() / 1000)), nonce = randomBytes(16).toString("base64url");
        const minted = await remember(await teamFetch("/api/cloud/pairing", { method: "POST", headers: { ...EDGE, "content-type": "application/json",
          "x-omb-cloud-timestamp": timestamp, "x-omb-cloud-nonce": nonce, "x-omb-cloud-signature": `v1=${cloudPairingSignature(options.secret ?? secret, timestamp, nonce, body)}` }, body }));
        const grant = parse(await minted.text());
        if (minted.status !== 200) return { status: minted.status, body: grant, token: null };
        const paired = await remember(await teamFetch("/api/auth/pair", { method: "POST", headers: { ...EDGE, "content-type": "application/json" }, body: JSON.stringify({ code: grant.code }) }));
        const session = parse(await paired.text());
        if (paired.status !== 200) return { status: paired.status, body: session, token: null };
        if (!chiefNamed && member && member.role !== "member") {
          chiefNamed = true;
          await nameChief(session.token as string);
        }
        return { status: paired.status, body: session, token: session.token as string };
      },
      as,
      signed: (method, path, body) => signedRequest(teamBase, method, path, body === undefined ? "" : JSON.stringify(body)),
      async capability(botId, threadId, kind) {
        // A loopback caller with the private key, as the harness mints one: never through the edge.
        const minted = await fetch(`${teamBase}/api/testing/internal-capability`, { method: "POST", headers: { "content-type": "application/json", "x-openmausbot-test-capability": CAPABILITY_KEY }, body: JSON.stringify({ botId, threadId, ...(kind ? { kind } : {}) }) });
        const answer = parse(await minted.text());
        if (minted.status !== 200 && minted.status !== 201) throw new Error(`no test capability: ${minted.status} ${JSON.stringify(answer)}`);
        return answer.token as string;
      },
      async relaunch(more = {}) {
        if (teamServer.connected) {
          teamServer.send("stop");
          await waitForExit(teamServer, { graceMs: 10_000 });
        } else await waitForExit(teamServer, { signal: "SIGTERM" });
        teamServer = await startTeam(more);
      },
    };
  }

  const local = async (method: string, path: string, body?: unknown) => {
    const response = await remember(await fetch(`${desktopBase}${path}`, { method, headers: {
      "x-openmausbot-desktop-owner": ownerCapability, ...(body === undefined ? {} : { "content-type": "application/json" }) },
    body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, body: parse(await response.text()) };
  };
  const onCloud = async (method: string, path: string, body?: unknown) => {
    const response = await remember(await fetch(`${cloudBase}${path}`, { method, headers: { ...EDGE, authorization: `Bearer ${owner}`,
      ...(body === undefined ? {} : { "content-type": "application/json" }) }, body: body === undefined ? undefined : JSON.stringify(body) }));
    return { status: response.status, body: parse(await response.text()) };
  };
  for (let tries = 0; (await local("GET", "/api/bots")).status !== 200 && tries < 50; tries++) await new Promise((resolve) => setTimeout(resolve, 100));

  const handlers = new Map<string, (...args: unknown[]) => unknown>();
  const port = { postMessage: (message: unknown) => { desktop.send(message as object); } };
  const fixture = { intercept: null as CloudSendFixture["intercept"] };
  const chatRequests: CloudSendFixture["chatRequests"] = [];
  const sessions: CloudSendFixture["sessions"] = [];
  const throughEdge = (bearer: string | null) => async (url: string | URL | Request, init: RequestInit = {}) => {
    const forged = fixture.intercept?.(String(url), init);
    if (forged) return forged;
    if (String(url).endsWith("/api/cloud-send/chats") && init.method === "POST" && typeof init.body === "string") {
      chatRequests.push((JSON.parse(init.body) as { conversations: Array<{ threadId: string; rows: unknown[] }> }).conversations.map((entry) => ({ threadId: entry.threadId, rows: entry.rows.length })));
    }
    if (String(url).endsWith("/api/auth/pair") && typeof init.body === "string") {
      const { label } = JSON.parse(init.body) as { label: string };
      labels.push(label);
      sessions.push({ label, background: (init.headers as Record<string, string>)["x-omb-background"] === "1" });
    }
    return remember(await fetch(url, { ...init, headers: { ...init.headers as Record<string, string>, ...EDGE, ...(bearer ? { authorization: `Bearer ${bearer}` } : {}) } }));
  };
  const wire = () => installCloudSend({
    ipcMain: { handle: (channel, handler) => { handlers.set(channel, handler); } },
    cloudPage: (event) => (event as { page?: "local" | "cloud" })?.page ?? null,
    server: () => port,
    local: async (route, init = {}) => remember(await fetch(`${desktopBase}${route}`, { ...init, headers: { "x-openmausbot-desktop-owner": ownerCapability } })),
    home: () => ({ origin: cloudBase, grant: async () => ({ origin: cloudBase, code: await mintCode("Rethos app (Cloud)") }) }),
    cookieFetch: throughEdge(owner) as typeof fetch,
    reconnect: async () => false,
    power: { asleep: () => false },
    file: () => join(root, "cloud-send.json"),
    window: () => null,
    localOrigin: () => desktopBase,
    fetch: throughEdge(null) as typeof fetch,
    engineWaitMs: 2_000,
    patience: { stallMs: 0, waits: [0], blips: [] },
    ...(space ? { space } : {}),

  });
  let main = wire();
  const asks = createLoginHandoffClient();
  const older = () => createCloudSend({
    local: async (route, init) => remember(await fetch(`${desktopBase}${route}`, { method: init?.method ?? "GET", headers: { "x-openmausbot-desktop-owner": ownerCapability } })),
    cloud: {
      origin: () => cloudBase,
      asleep: () => false,
      read: (route) => throughEdge(owner)(`${cloudBase}${route}`, { headers: { accept: "application/json", ...BACKGROUND_HEADERS } }),
      open: () => openOwnerSession({ origin: cloudBase, grant: async () => ({ origin: cloudBase, code: await mintCode("Rethos app (Cloud)") }) }, throughEdge(null) as typeof fetch),
    },
    handoff: (what) => asks.request(port, what as ConnectionAsk),
    store: {
      read: () => { try { return JSON.parse(readFileSync(join(root, "cloud-send.json"), "utf8")); } catch { return null; } },
      write: (value) => { const file = join(root, "cloud-send.json"); writeFileSync(`${file}.tmp`, JSON.stringify(value)); renameSync(`${file}.tmp`, file); },
    },
  });
  const reopened = () => { main = wire(); };
  const listen = () => {
    desktop.on("message", (message) => main.receive(port, message));
    desktop.on("message", (message) => { asks.receive(port, message); });
  };
  listen();

  return {
    root, desktopBase, cloudBase, get owner() { return owner; }, ownerCapability, secret, cloudMachineId: CLOUD_MACHINE_ID, edge: EDGE, answers, labels, logs: () => logs, local, onCloud, desktopInstallation,
    get intercept() { return fixture.intercept; },
    set intercept(hook) { fixture.intercept = hook; },
    desktopDataDir: join(root, "desktop", ".openmausbot"),
    async relaunch({ kill = true, cloud: cloudMore, dataDir } = {}) {
      await waitForExit(desktop, { signal: kill ? "SIGKILL" : "SIGTERM" });
      if (cloudMore) {
        await waitForExit(cloud, { signal: "SIGTERM" });
        cloud = await startCloud(cloudMore);
        owner = await pairOwner();
      }
      desktop = await startDesktop(dataDir);
      for (let tries = 0; (await local("GET", "/api/bots")).status !== 200 && tries < 50; tries++) await new Promise((resolve) => setTimeout(resolve, 100));
      main = wire();
      listen();
    },
    handoff: (what) => asks.request(port, what as ConnectionAsk),
    async picture(bytes) {
      const response = await fetch(`${desktopBase}/api/attachments`, { method: "POST", headers: { "x-openmausbot-desktop-owner": ownerCapability, "content-type": "image/png" }, body: bytes });
      return `/api/attachments/${((await response.json()) as { path: string }).path.split(/[\\/]/).pop()}`;
    },
    call: <T>(channel: string, page: "local" | "cloud", ...args: unknown[]) => Promise.resolve(handlers.get(channel)!({ page }, ...args)) as Promise<T>,
    async olderSend(input = {}) {
      try { return await older().send({ ...input, reason: "button" }); } finally { reopened(); }
    },
    olderCompare: () => older().compare(),
    move: (options) => main.move(options),
    check: () => main.check(),
    sessions,
    chatRequests,
    team: teamFixture,
    grant: async (label) => ({ origin: cloudBase, code: await mintCode(label), expiresAt: Date.now() + 300_000 }),
    async close() {
      for (const child of children) await waitForExit(child, { signal: "SIGTERM" });
      await removeTempDir(root);
    },
  };
}
