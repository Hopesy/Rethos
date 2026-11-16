import assert from "node:assert/strict";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, sep } from "node:path";
import test from "node:test";

import { cleanWorkspaceConfig, cleanWorkspaceDir, createCleanWorkspace, DEFAULT_PROFILE, profileDir, profilesDir } from "./clean-workspace.mjs";
import { cloudLendingVerdict } from "./computer-sharing.mjs";
import { createLendingTarget } from "./lending-target.mjs";
import { WELCOME_VERSION } from "./onboarding-record.mjs";

const owner = { id: "acct-1", email: "a@omb-test.example" };
const json = (value, status = 200) => new Response(JSON.stringify(value), { status });
const CLOUD = "https://omb-t-1.fly.dev";

/** A computer's data folder on disk, frozen for My Cloud, with the one server the app runs at a time: `running`, and each
 * request as [the folder it reached, method, route]. */
function computer(t, { frozen = { v: 1, at: 1, cloud: CLOUD } } = {}) {
  const parent = mkdtempSync(join(tmpdir(), "omb-clean-"));
  t.after(() => rmSync(parent, { recursive: true, force: true }));
  const dataDir = join(parent, ".openmausbot");
  const w = { dataDir, cleanDir: cleanWorkspaceDir(dataDir), running: dataDir, swaps: [], requests: [], swapFails: false, changes: 0 };
  mkdirSync(dataDir, { recursive: true });
  w.write = (name, text) => { writeFileSync(join(dataDir, name), text); };
  w.clean = createCleanWorkspace({
    dataDir: () => dataDir, running: () => w.running,
    swap: async (dir) => { w.swaps.push(dir); if (w.swapFails) return { ok: false, error: "switch-failed" }; await new Promise((resolve) => setImmediate(resolve)); w.running = dir; return { ok: true }; },
    changed: () => { w.changes++; },
  });
  w.request = async (route, init) => { w.requests.push([w.running, (init?.method ?? "GET").toUpperCase(), route]); return json({ frozen: w.running === dataDir && Boolean(frozen) }); };
  if (frozen) w.write("moved.json", JSON.stringify(frozen));
  w.write("environment-id", "own-copy-id\n");
  return w;
}

test("a clean workspace sits beside the data folder, never in it: a move carries that folder and forgetting the copy empties it", () => {
  assert.equal(cleanWorkspaceDir("/Users/a/.openmausbot"), "/Users/a/.openmausbot-clean");
});

test("opening it starts the server on its own folder, once, set up so the new-user setup never shows", async (t) => {
  const w = computer(t);
  w.write("config.json", JSON.stringify({ language: "de", providers: { key: "secret-of-the-frozen-copy" } }));
  assert.equal(w.clean.active(), false);
  assert.equal(await w.clean.enter(), true);
  assert.deepEqual(w.swaps, [w.cleanDir]);
  assert.equal(w.clean.active(), true);
  assert.equal(w.changes, 1, "what depends on it (lending) looks again");
  const config = JSON.parse(readFileSync(join(w.cleanDir, "config.json"), "utf8"));
  assert.equal(config.language, "de");
  assert.equal(config.onboarding.version, WELCOME_VERSION);
  assert.ok(config.onboarding.completedAt);
  assert.equal(JSON.stringify(config).includes("secret"), false, "nothing but the language comes from the frozen copy's config");
  assert.equal(await w.clean.enter(), true);
  assert.deepEqual(w.swaps, [w.cleanDir], "open already: no second start");
});

test("whatever someone did there stays: opening it again never writes over its config, and leaving deletes nothing", async (t) => {
  const w = computer(t);
  await w.clean.enter();
  writeFileSync(join(w.cleanDir, "config.json"), JSON.stringify({ language: "fr", theirs: true }));
  assert.equal(await w.clean.leave(), true);
  assert.equal(w.running, w.dataDir);
  assert.equal(w.clean.active(), false);
  await w.clean.enter();
  assert.deepEqual(JSON.parse(readFileSync(join(w.cleanDir, "config.json"), "utf8")), { language: "fr", theirs: true });
  assert.equal(existsSync(join(w.dataDir, "moved.json")), true, "the frozen copy's marker is never touched");
});

test("leaving only ever swaps from the clean workspace, and a swap that fails says so", async (t) => {
  const w = computer(t);
  assert.equal(await w.clean.leave(), true);
  assert.deepEqual(w.swaps, [], "this computer's own copy already runs");
  w.swapFails = true;
  assert.equal(await w.clean.enter(), false, "the window then says why, as before");
  assert.equal(w.clean.active(), false);
  assert.equal(w.changes, 0);
});

test("a local environment the person chose is no frozen copy: it stays, and nothing is set up", async (t) => {
  const w = computer(t);
  w.running = `${w.dataDir}-work`;
  assert.equal(await w.clean.enter(), true);
  assert.deepEqual(w.swaps, []);
  assert.equal(existsSync(w.cleanDir), false);
});

test("it isn't for an app that can't sign in here", async (t) => {
  const w = computer(t);
  const off = createCleanWorkspace({ dataDir: () => w.dataDir, running: () => w.running, swap: async (dir) => { w.swaps.push(dir); return { ok: true }; }, allowed: () => false });
  assert.equal(await off.enter(), false);
  assert.deepEqual(w.swaps, []);
});

test("one swap at a time: open, leave and open again at once end where the last asked, each after the one before", async (t) => {
  const w = computer(t);
  const seen = await Promise.all([w.clean.enter(), w.clean.leave(), w.clean.enter()]);
  assert.deepEqual(seen, [true, true, true]);
  assert.deepEqual(w.swaps, [w.cleanDir, w.dataDir, w.cleanDir]);
  assert.equal(w.clean.active(), true);
});

test("settled() waits for the swaps asked for so far, and is already done with none", async (t) => {
  const w = computer(t);
  await w.clean.settled();
  assert.deepEqual(w.swaps, []);
  const entering = w.clean.enter();
  await w.clean.settled();
  assert.deepEqual(w.swaps, [w.cleanDir], "after the swap under way");
  await entering;
});

test("the marker is the frozen copy's own, read from its folder whichever server runs", async (t) => {
  const w = computer(t, { frozen: { v: 1, at: 1, cloud: CLOUD, place: "Garage" } });
  await w.clean.enter();
  assert.deepEqual(w.clean.marker(), { frozen: true, cloud: CLOUD, place: "Garage" });
  w.write("moved.json", "not json");
  assert.deepEqual(w.clean.marker(), { frozen: true }, "as the server reads it: a marker it can't read is still frozen");
  rmSync(join(w.dataDir, "moved.json"));
  assert.deepEqual(w.clean.marker(), { frozen: false });
});

test("the move's server, while the clean workspace runs: the copy's own marker and identity from its files, everything else refused", async (t) => {
  const w = computer(t);
  const request = w.clean.realCopy(w.request);
  await request("/api/bots?messages=0");
  assert.deepEqual(w.requests, [[w.dataDir, "GET", "/api/bots?messages=0"]], "its own copy running: passed on");
  w.requests.length = 0;
  await w.clean.enter();
  assert.deepEqual(await (await request("/api/move/freeze")).json(), { frozen: true, cloud: CLOUD });
  assert.deepEqual(await (await request("/.well-known/openmausbot/environment")).json(), { environmentId: "own-copy-id" }, "the Admin never hears the clean folder's identity as this computer's");
  for (const [route, init] of [["/api/bots?messages=0"], ["/api/cloud-send?move=1"], ["/api/config"], ["/api/move/freeze", { method: "POST" }], ["/api/move/freeze", { method: "DELETE" }], ["/api/move/forget", { method: "POST" }], ["/api/workspace-backup/upload", { method: "POST" }]]) {
    await assert.rejects(request(route, init), { code: "clean-workspace" }, `${init?.method ?? "GET"} ${route}`);
  }
  assert.deepEqual(w.requests, [], "nothing reached the clean workspace's server");
});

test("what must reach the frozen copy brings its server back first, and nothing opens the clean workspace until it's done", async (t) => {
  const w = computer(t);
  await w.clean.enter();
  let release;
  const held = new Promise((resolve) => { release = resolve; });
  const lift = w.clean.holding(async () => {
    assert.equal(w.running, w.dataDir, "its own server, before the work");
    assert.equal(await w.clean.enter(), false, "the window asking meanwhile gets no clean workspace");
    assert.equal(w.running, w.dataDir);
    await held;
    return "lifted";
  });
  release();
  assert.equal(await lift, "lifted");
  assert.equal(await w.clean.enter(), true, "afterwards it opens again if it's still wanted");
  w.swapFails = true;
  await assert.rejects(w.clean.holding(async () => assert.fail("never on the clean workspace")), /could not go back/u);
});

test("a clean workspace's first config carries the language and that the setup was seen, nothing else", () => {
  assert.deepEqual(Object.keys(cleanWorkspaceConfig("en")).sort(), ["language", "onboarding"]);
  assert.equal(cleanWorkspaceConfig().language, undefined);
});

test("nothing pops up to bring bots here beside a line saying they're safe in the Cloud: the hint is the one that popup looks for", () => {
  const notices = readFileSync(new URL("../src/lib/notices.ts", import.meta.url), "utf8");
  const popup = /GROK_MOVE_NOTICE = "([^"]+)"/u.exec(notices)?.[1];
  assert.ok(popup);
  assert.equal(cleanWorkspaceConfig().onboarding.hintsSeen.includes(popup), true);
});

test("no lending from the clean workspace: nothing is lent or asked while it runs, and a grant only pauses, so it goes on after", async (t) => {
  const w = computer(t);
  const env = { id: "c", origin: CLOUD, cloud: { id: "c" } };
  const state = { status: "connected", account: owner, machine: { status: "ready", origin: CLOUD } };
  const target = createLendingTarget({ ownHome: () => state.status === "connected" ? { origin: CLOUD, environmentId: "fixture" } : null, clean: w.clean, environments: () => [env] });
  const grant = { accountId: "own:fixture", origin: CLOUD };
  assert.deepEqual(cloudLendingVerdict(grant, target.cloud(env), env), { allow: true });
  await w.clean.enter();
  assert.equal(target.environment(), null);
  assert.deepEqual(target.places(), []);
  assert.deepEqual(cloudLendingVerdict(grant, target.cloud(env), env), { pause: "unverified" });
  await w.clean.leave();
  assert.deepEqual(cloudLendingVerdict(grant, target.cloud(env), env), { allow: true });
});

test("a profile sits in a folder of its own, by its stable id, under one folder beside the data folder: never in the frozen copy's", () => {
  assert.equal(profilesDir("/Users/a/.openmausbot"), "/Users/a/.openmausbot-profiles");
  assert.equal(profileDir("/Users/a/.openmausbot", DEFAULT_PROFILE), join("/Users/a/.openmausbot-profiles", "default"));
});

test("This Mac's profile opens fresh on its own folder, and the frozen copy stays frozen: its marker, its bots and its config untouched", async (t) => {
  const w = computer(t);
  w.write("config.json", JSON.stringify({ language: "pt-BR", providers: { key: "secret-of-the-frozen-copy" } }));
  w.write("bots.json", JSON.stringify([{ id: "nova" }]));
  const dir = profileDir(w.dataDir, DEFAULT_PROFILE);
  assert.equal(await w.clean.open(), true);
  assert.deepEqual(w.swaps, [dir]);
  assert.deepEqual([w.clean.active(), w.clean.profile(), w.clean.stranded(), w.clean.ownCopy()], [true, DEFAULT_PROFILE, false, false]);
  assert.equal(w.changes, 1, "lending looks again");
  const config = JSON.parse(readFileSync(join(dir, "config.json"), "utf8"));
  assert.deepEqual(Object.keys(config).sort(), ["language", "onboarding"], "fresh: nothing of the frozen copy's but its language");
  assert.equal(existsSync(join(dir, "bots.json")), false);
  assert.deepEqual(JSON.parse(readFileSync(join(w.dataDir, "moved.json"), "utf8")), { v: 1, at: 1, cloud: CLOUD }, "never unfrozen");
  assert.equal(readFileSync(join(w.dataDir, "bots.json"), "utf8"), JSON.stringify([{ id: "nova" }]));
  assert.equal(JSON.parse(readFileSync(join(w.dataDir, "config.json"), "utf8")).providers.key, "secret-of-the-frozen-copy");
  assert.equal(existsSync(w.cleanDir), false, "the workspace for nobody signed in is another folder");
  assert.equal(await w.clean.open(DEFAULT_PROFILE), true);
  assert.deepEqual(w.swaps, [dir], "open already: no second start");
  writeFileSync(join(dir, "config.json"), JSON.stringify({ theirs: true }));
  assert.equal(await w.clean.leave(), true);
  assert.equal(w.running, w.dataDir);
  assert.equal(await w.clean.open(), true);
  assert.deepEqual(JSON.parse(readFileSync(join(dir, "config.json"), "utf8")), { theirs: true }, "what they made there stays");
});

test("a profile id is a folder name and nothing else, and the move's code never reaches a profile", async (t) => {
  const w = computer(t);
  for (const id of ["../.openmausbot", "", "Work", "a/b", "."]) assert.equal(await w.clean.open(id), false, id);
  assert.deepEqual(w.swaps, []);
  await w.clean.open();
  const request = w.clean.realCopy(w.request);
  assert.deepEqual(await (await request("/api/move/freeze")).json(), { frozen: true, cloud: CLOUD }, "the frozen copy's own marker");
  await assert.rejects(request("/api/move/freeze", { method: "DELETE" }), (error) => error.code === "clean-workspace");
  await assert.rejects(request("/api/bots"), (error) => error.code === "clean-workspace");
  assert.deepEqual(w.requests, []);
});

test("lending goes on from a profile: the sign-in alone decides, and only the workspace for nobody who can reach the bots stops it", async (t) => {
  const w = computer(t);
  const env = { id: "c", origin: CLOUD, cloud: { id: "c" } };
  let state = { status: "connected", account: owner, machine: { status: "ready", origin: CLOUD } };
  const target = createLendingTarget({ ownHome: () => state.status === "connected" ? { origin: CLOUD, environmentId: "fixture" } : null, clean: w.clean, environments: () => [env] });
  const grant = { accountId: "own:fixture", origin: CLOUD };
  await w.clean.open();
  assert.equal(target.environment(), env);
  assert.deepEqual(target.places(), [env]);
  assert.deepEqual(cloudLendingVerdict(grant, target.cloud(env), env), { allow: true });
  state = { status: "signed-out", account: null, machine: null };
  assert.notDeepEqual(cloudLendingVerdict(grant, target.cloud(env), env), { allow: true }, "signed out: nothing is lent, profile or not");
});

/** A named local environment's folder: anywhere the person chose, neither the clean workspace nor under the profiles' folder. */
const workFolder = (w) => join(dirname(w.dataDir), "work-environment");

test("a named local environment is not this computer's own copy: the move gets the copy's own marker and identity, nothing else", async (t) => {
  const w = computer(t);
  const request = w.clean.realCopy(w.request);
  w.running = workFolder(w);
  assert.deepEqual([w.clean.active(), w.clean.profile(), w.clean.ownCopy()], [false, null, false]);
  assert.deepEqual(await (await request("/api/move/freeze")).json(), { frozen: true, cloud: CLOUD });
  assert.deepEqual(await (await request("/.well-known/openmausbot/environment")).json(), { environmentId: "own-copy-id" }, "the Admin never hears the environment's identity as this computer's");
  for (const [route, init] of [["/api/bots?messages=0"], ["/api/cloud-send?move=1"], ["/api/move/freeze", { method: "POST" }], ["/api/move/freeze", { method: "DELETE" }], ["/api/move/forget", { method: "POST" }]]) {
    await assert.rejects(request(route, init), { code: "clean-workspace" }, `${init?.method ?? "GET"} ${route}`);
  }
  await assert.rejects(w.clean.holding(() => request("/api/move/forget", { method: "POST" })), { code: "clean-workspace" });
  assert.deepEqual(w.swaps, [], "the environment the person chose stays open");
  assert.deepEqual(w.requests, [], "nothing reached its server");
});

test("only the data folder itself is this computer's own copy: however it is spelled, and never with no server at all", (t) => {
  const w = computer(t);
  w.running = `${w.dataDir}${sep}`;
  assert.equal(w.clean.ownCopy(), true, "a trailing separator is the same folder");
  w.running = join(w.dataDir, "..", ".openmausbot");
  assert.equal(w.clean.ownCopy(), true);
  w.running = null;
  assert.equal(w.clean.ownCopy(), false);
  w.running = `${w.dataDir}-work`;
  assert.equal(w.clean.ownCopy(), false, "a folder beside it is another folder");
});
