import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { patchOrganizationUpdater } from "../scripts/patch-organization-updater.mjs";
import { CLOUD_DEEP_LINK, createCloudEntry, isCloudDeepLink, takeCloudDeepLink } from "./cloud-entry.mjs";

const main = readFileSync(new URL("./main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
const between = (start, end) => {
  const from = main.indexOf(start), to = main.indexOf(end, from);
  assert.ok(from !== -1 && to !== -1, `${start} … ${end}`);
  return main.slice(from, to);
};
function fixture({ open = async () => true } = {}) {
  const calls = [];
  const entry = createCloudEntry({
    reveal: () => calls.push("reveal"),
    open: async () => { calls.push("open"); return open(); },
  });
  return { calls, entry };
}
const settle = async () => { for (let i = 0; i < 5; i++) await Promise.resolve(); };

test("the Cloud protocol is a fixed action without URL routing or credentials", () => {
  assert.equal(CLOUD_DEEP_LINK, "openmausbot://cloud");
  assert.equal(isCloudDeepLink("openmausbot://cloud"), true);
  for (const value of [null, undefined, {}, ["openmausbot://cloud"], "", "openmausbot://cloud/", "openmausbot://cloud?", "openmausbot://cloud#",
    "openmausbot://cloud?code=ABCDE-FGHJK", "openmausbot://cloud#code=ABCD-EFGH-JKLM", "openmausbot://cloud?url=https://home.example",
    "openmausbot://cloud/pair", "openmausbot://user@cloud", "openmausbot://cloud:443", "openmausbot://cloud.evil", "openmausbot://CLOUD",
    "OPENMAUSBOT://cloud", "openmausbot:cloud", "openmausbot:///cloud", "https://cloud", " openmausbot://cloud", "openmausbot://cloud ",
    "openmausbot://%63loud", "openmausbot://organization", "openmausbot://install?url=https://github.com/x/y"]) {
    assert.equal(isCloudDeepLink(value), false, String(value));
  }
});

test("consuming a launch action prevents it replaying on a later restart without changing other arguments", () => {
  const original = ["/Applications/Rethos", "--profile=fixture", "openmausbot://cloud?ignored", "openmausbot://organization", "openmausbot://install/example"];
  const argv = [...original, "openmausbot://cloud", "openmausbot://cloud"];
  assert.equal(takeCloudDeepLink(argv), true);
  assert.deepEqual(argv, original);
  assert.equal(takeCloudDeepLink(argv), false, "the action is consumed exactly once");
  assert.deepEqual(argv, original);
});

test("a cold-start link waits until main can navigate, then opens exactly once", async () => {
  const h = fixture();
  const argv = ["/Applications/Rethos", "--fixture", "openmausbot://cloud"];
  assert.equal(h.entry.fromLaunch(argv), true);
  assert.deepEqual(argv, ["/Applications/Rethos", "--fixture"]);
  await settle();
  assert.deepEqual(h.calls, [], "no window exists to reveal or navigate yet");
  assert.equal(await h.entry.ready(), true);
  assert.deepEqual(h.calls, ["open"]);
  assert.equal(await h.entry.ready(), false, "a delivered link is not delivered again");
  assert.deepEqual(h.calls, ["open"]);
});

test("a launch without the link leaves nothing pending", async () => {
  const h = fixture();
  assert.equal(h.entry.fromLaunch(["/Applications/Rethos", "openmausbot://cloud/"]), false);
  assert.equal(await h.entry.ready(), false);
  assert.deepEqual(h.calls, []);
});

test("macOS open-url before ready is held, and several links open once", async () => {
  const h = fixture();
  assert.equal(h.entry.fromUrl("openmausbot://cloud"), true);
  assert.equal(h.entry.fromUrl("openmausbot://cloud"), true);
  await settle();
  assert.deepEqual(h.calls, ["reveal", "reveal"]);
  assert.equal(await h.entry.ready(), true);
  assert.deepEqual(h.calls, ["reveal", "reveal", "open"]);
});

test("once ready, open-url and a second instance open immediately and consume the argument", async () => {
  const h = fixture();
  await h.entry.ready();
  assert.equal(h.entry.fromUrl("openmausbot://cloud"), true);
  await settle();
  assert.deepEqual(h.calls, ["reveal", "open"]);
  const commandLine = ["C:\\Rethos.exe", "--flag", "openmausbot://cloud"];
  assert.equal(h.entry.fromArgs(commandLine), true);
  await settle();
  assert.deepEqual(h.calls, ["reveal", "open", "reveal", "open"]);
  assert.deepEqual(commandLine, ["C:\\Rethos.exe", "--flag"]);
});

test("anything else is left to the other link handlers without revealing or opening", async () => {
  const h = fixture();
  await h.entry.ready();
  for (const url of ["openmausbot://organization", "openmausbot://install?url=https://github.com/x/y", "openmausbot://cloud?code=X", "openmausbot://cloud/"]) {
    assert.equal(h.entry.fromUrl(url), false);
    const argv = ["/app", url];
    assert.equal(h.entry.fromArgs(argv), false);
    assert.deepEqual(argv, ["/app", url]);
  }
  await settle();
  assert.deepEqual(h.calls, []);
});

test("a failed open is contained and a later link still opens", async () => {
  let fail = true;
  const h = fixture({ open: async () => { if (fail) throw new Error("load failed"); return true; } });
  h.entry.fromLaunch(["/app", "openmausbot://cloud"]);
  assert.equal(await h.entry.ready(), false);
  fail = false;
  h.entry.fromUrl("openmausbot://cloud");
  await settle();
  assert.deepEqual(h.calls, ["open", "reveal", "open"]);
});

test("a consumed launch link is not replayed by the companion or updater relaunch", () => {
  const argv = ["/fixture/Rethos", "--fixture", "openmausbot://cloud", "openmausbot://cloud?ignored"];
  takeCloudDeepLink(argv);
  const calls = [];
  runInNewContext(`${between("function relaunchAfterDesktopRemoteChange()", 'ipcMain.handle("desktop-remote:state"')}\nrelaunchAfterDesktopRemoteChange();`, {
    desktopShutdownStarted: false, process: { argv }, setTimeout: callback => { callback(); return {}; },
    app: { relaunch: options => calls.push(options.args), quit: () => {} },
  });
  const patched = patchOrganizationUpdater("      relaunch() {\n        this.app.relaunch();\n      }");
  runInNewContext(`({ app, ${patched} }).relaunch();`, { process: { argv }, app: { relaunch: options => calls.push(options.args) } });
  assert.deepEqual(calls, [["--fixture", "openmausbot://cloud?ignored"], ["--fixture", "openmausbot://cloud?ignored"]]);
});

test("main takes the link from launch arguments, open-url and a second instance", () => {
  assert.ok(main.indexOf("cloudEntry.fromLaunch(process.argv);") < main.indexOf("app.requestSingleInstanceLock()"),
    "the launch argument is consumed before anything can relaunch");
  assert.match(between('app.on("open-url"', "});"), /!queueOrganizationEntry\(url\) && !cloudEntry\.fromUrl\(url\) && !queuePackageInstall\(url\)/);
  const secondInstance = between('app.on("second-instance"', "\n});");
  assert.ok(secondInstance.indexOf("if (cloudEntry.fromArgs(commandLine)) return;") > secondInstance.indexOf("takeOrganizationDeepLink(commandLine)"));
  assert.ok(secondInstance.indexOf("if (cloudEntry.fromArgs(commandLine)) return;") < secondInstance.indexOf("packageUrlFromCommandLine(commandLine)"));
});

test("startup consumes old Cloud links while keeping self-hosted navigation", () => {
  const startup = between("  let restoredOrganizationEntry = false;", "  // Reconcile incomplete setup");
  assert.ok(startup.indexOf("await cloudEntry.ready()") < startup.indexOf("await showStartPlace()"));
  assert.doesNotMatch(main, /cloudAccountStarted = ensureCloudAccount\(\)\.start\(\)/);
  assert.doesNotMatch(startup, /ensureManagedDesktop\(\)\.start\(\)/);
});

test("official Cloud entry returns without opening an account or changing workspaces", async () => {
  const entry = between("async function openCloudEntry()", "\n}\n") + "\n}";
  assert.equal(await runInNewContext(entry + "\nopenCloudEntry();", {}), false);
});

test("Cloud offers and add actions stay disabled in a self-hosted build", async () => {
  const allowed = between("function cloudOffersAllowed()", "\n}\n") + "\n}";
  const add = between("async function openCloudAdd(source)", "\n}\n") + "\n}";
  assert.equal(runInNewContext(allowed + "\ncloudOffersAllowed();", {}), false);
  await runInNewContext(allowed + "\n" + add + "\nopenCloudAdd('menu');", {});
  assert.match(between("function openWorkspaceSettings(computerId)", "\n}\n"), /workspaces:open-settings/);
});
