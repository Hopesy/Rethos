import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import vm from "node:vm";
import { installCloudRail } from "./cloud-rail.mjs";
const origin = "http://127.0.0.1:48993";
const removed = ["cloudAccount", "cloudAdd", "cloudPlan", "cloudSendPage", "organization", "accounts", "accountSheet", "companyBackups", "home"];

for (const remote of [false, true]) for (const legacyCompanyFlag of [false, true]) {
  test("self-hosted bridge: remote=" + remote + ", legacy company flag=" + legacyCompanyFlag, () => {
    let bridge;
    const calls = [];
    vm.runInNewContext(readFileSync(new URL("./preload.cjs", import.meta.url), "utf8"), {
      process: { platform: "fixture", argv: ["--omb-local-origin=" + origin, ...(legacyCompanyFlag ? ["--omb-company-desktop=1"] : [])] },
      location: { origin: remote ? "https://vps.example.test" : origin }, TextEncoder, localStorage: { getItem: () => null },
      require: () => ({ webUtils: {}, contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
        ipcRenderer: { on() {}, removeListener() {}, send() {}, invoke: (...args) => { calls.push(args); return Promise.resolve(null); } } }),
    });
    for (const key of removed) assert.equal(bridge[key], undefined, key);
    assert.equal(typeof bridge.workspaces, "object");
    if (!remote) for (const key of ["environments", "computerSharing", "companion"]) assert.equal(typeof bridge[key], "object", key);
    assert.deepEqual(calls, []);
  });
}

test("official cloud and organization IPC refuse requests before any client is created", () => {
  const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8");
  const start = source.indexOf("const localWorkspaceOnly =");
  const end = source.indexOf('\nfor (const method', start);
  assert.ok(start >= 0 && end > start);
  let guard, invoked = 0;
  vm.runInNewContext(source.slice(start, end) + "\nfixture(localWorkspaceOnly);", {
    localOnly: (_channel, handler) => handler, workspaceOnly: handler => handler, fixture: value => { guard = value; },
  });
  for (const channel of ["cloud-account:begin", "cloud-buy:checkout", "organization:reopen", "company-backups:state"]) {
    assert.throws(() => guard(channel, () => invoked++)({}), /self-hosted/);
  }
  assert.equal(invoked, 0);
  guard("workspaces:connect", () => invoked++)({});
  assert.equal(invoked, 1);
});

test("the rail offers local workspaces and own servers even with a legacy cloud account", async () => {
  const handlers = new Map(), runs = [];
  installCloudRail({
    ipcMain: { handle: (key, fn) => handlers.set(key, fn) }, guard: fn => fn, trusted: () => true,
    places: () => [], open() {}, account: () => ({ state: () => ({ organizations: { canAdd: true } }) }),
    clipboard: {}, openCloud() {}, targets: () => [],
    local: { creatable: () => true },
    add: { choices: () => ({ cloud: true, organization: true, account: true, link: true, address: true }),
      run: (...args) => runs.push(args) },
  });
  const state = await handlers.get("workspaces:places")({});
  assert.deepEqual(state.add, { cloud: false, organization: false, account: false, link: true, address: true, local: true });
  assert.throws(() => handlers.get("workspaces:add")({}, "cloud"), /cannot|can't|add/i);
  handlers.get("workspaces:add")({}, "address");
  assert.deepEqual(runs, [["address"]]);
});
