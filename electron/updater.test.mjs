import { EventEmitter } from "node:events";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import environments from "./environments.cjs";
import localOriginModule from "./local-origin.cjs";

const LOCAL = "http://127.0.0.1:8799";
const CLOUD = "https://home-7f3k2.fly.dev";
const OTHER = "https://bots.example.test";

const fixture = vi.hoisted(() => ({ autoUpdater: null, handlers: new Map(), home: "" }));

vi.mock("electron", () => ({
  app: { isPackaged: true, getPath: () => fixture.home, getVersion: () => "1.0.0", hide: vi.fn() },
  clipboard: { writeText: vi.fn() },
  ipcMain: { handle: (name, handler) => fixture.handlers.set(name, handler) },
}));
vi.mock("node:module", () => ({
  createRequire: () => () => ({ autoUpdater: fixture.autoUpdater }),
}));

function page(origin) {
  const mainFrame = { url: `${origin}/` };
  const webContents = { mainFrame, send: vi.fn() };
  return { webContents, event: { sender: webContents, senderFrame: mainFrame } };
}

function mainRule() {
  const source = readFileSync(new URL("./main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
  const start = source.indexOf("const updaterPageAllowed ="), end = source.indexOf("\n\n", start);
  const window = { isDestroyed: () => false, webContents: null };
  const listeners = new Map();
  const context = vm.createContext({ mainWindow: window, workspaceSenderAllowed: environments.workspaceSenderAllowed,
    environmentsState: { environments: [], activeId: environments.LOCAL_ID }, rendererOrigin: () => LOCAL,
    ipcMain: { on: (channel, handler) => listeners.set(channel, handler) } });
  vm.runInContext(source.slice(start, end), context);
  const show = (shown, activeId = environments.LOCAL_ID) => { window.webContents = shown.webContents;
    context.environmentsState = { environments: [{ id: "cloud", name: "Own server", origin: CLOUD }, { id: "vps", name: "VPS", origin: OTHER }], activeId }; };
  const offered = event => { const request = { ...event }; listeners.get("update:offered")(request); return request.returnValue; };
  return { context, window, show, offered, pageAllowed: vm.runInContext("updaterPageAllowed", context) };
}

async function load(pageAllowed, serverPage = undefined, confirmRestart = undefined) {
  vi.resetModules();
  fixture.handlers.clear();
  const autoUpdater = new EventEmitter();
  autoUpdater.checkForUpdates = vi.fn(async () => {
    autoUpdater.emit("checking-for-update");
    autoUpdater.emit("update-available", { version: "2.0.0" });
    return { isUpdateAvailable: true };
  });
  autoUpdater.downloadUpdate = vi.fn(async () => {
    autoUpdater.emit("download-progress", { percent: 50 });
    autoUpdater.emit("update-downloaded", { version: "2.0.0" });
    return ["/unused-staged-update.zip"];
  });
  autoUpdater.quitAndInstall = vi.fn();
  fixture.autoUpdater = autoUpdater;
  const updater = await import("./updater.mjs");
  updater.registerUpdaterIpc({ pageAllowed, ...(serverPage ? { serverPage, confirmRestart } : {}) });
  return { updater, autoUpdater, handlers: fixture.handlers };
}

const settle = async () => {
  for (let index = 0; index < 10; index += 1) await Promise.resolve();
};

beforeEach(() => {
  fixture.home = mkdtempSync(join(tmpdir(), "omb-updater-home-"));
  localOriginModule.setLocalOrigin(LOCAL);
  vi.useFakeTimers();
});
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
  rmSync(fixture.home, { recursive: true, force: true });
});

function bridgeFor(origin, { clicked = false, rule = null } = {}) {
  let bridge;
  const invoked = [];
  const asked = [];
  const loading = page(origin);
  if (rule) rule.window.webContents = loading.webContents;
  vm.runInNewContext(readFileSync(new URL("./preload.cjs", import.meta.url), "utf8"), {
    process: { platform: "darwin", argv: [`--omb-local-origin=${LOCAL}`] },
    location: { origin }, navigator: { userActivation: { isActive: clicked } },
    TextEncoder, localStorage: { getItem: () => null },
    require: () => ({
      webUtils: {},
      contextBridge: { exposeInMainWorld: (_name, value) => { bridge = value; } },
      ipcRenderer: {
        on() {}, removeListener() {}, send() {},
        sendSync: (channel) => { asked.push(channel); return rule ? rule.offered(loading.event) : undefined; },
        invoke: (...args) => { invoked.push(args); return Promise.resolve({ status: "idle" }); },
      },
    }),
  });
  return { bridge, invoked, asked };
}

it("My Cloud's page gets the update bridge, and it restarts the app only on the person's click", async () => {
  const local = bridgeFor(LOCAL);
  expect(Object.keys(local.bridge.updater).sort()).toEqual(["check", "install", "onState", "seen"]);
  expect(local.asked, "this computer's page has the whole bridge without asking").toEqual([]);
  await local.bridge.updater.install();
  expect(local.invoked).toEqual([["update:install"]]);

  const rule = mainRule();
  rule.show(page(CLOUD), "cloud");
  const cloud = bridgeFor(CLOUD, { rule });
  expect(Object.keys(cloud.bridge.updater).sort()).toEqual(["check", "install", "onState", "seen"]);
  await expect(cloud.bridge.updater.install()).rejects.toThrow(/Restart to update/);
  await cloud.bridge.updater.check();
  cloud.bridge.updater.onState(() => {});
  expect(cloud.invoked).toEqual([["update:check"], ["update:get-state"]]);
  const clicked = bridgeFor(CLOUD, { clicked: true, rule });
  await clicked.bridge.updater.install();
  expect(clicked.invoked).toEqual([["update:install"]]);
});

it("a downloaded update installs when the app quits, except a system package, which is the person's to install", async () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const resourcesPath = process.resourcesPath;
  const appImage = process.env.APPIMAGE;
  const resources = mkdtempSync(join(tmpdir(), "omb-updater-package-"));
  try {
    for (const [os, marker, image, installsOnQuit] of [
      ["darwin", null, null, true],
      ["win32", null, null, true],
      ["linux", null, "/home/a/Rethos.AppImage", true],
      ["linux", "deb", null, false],
      ["linux", "rpm", null, false],
    ]) {
      Object.defineProperty(process, "platform", { ...platform, value: os });
      process.resourcesPath = resources;
      rmSync(join(resources, "package-type"), { force: true });
      if (marker) writeFileSync(join(resources, "package-type"), marker);
      if (image) process.env.APPIMAGE = image;
      else delete process.env.APPIMAGE;
      const { updater, autoUpdater } = await load(() => false);
      updater.startUpdater();
      expect(autoUpdater.autoInstallOnAppQuit, `${os} ${marker ?? image ?? ""}`).toBe(installsOnQuit);
      expect(autoUpdater.autoDownload).toBe(false);
    }
  } finally {
    Object.defineProperty(process, "platform", platform);
    process.resourcesPath = resourcesPath;
    if (appImage === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = appImage;
    rmSync(resources, { recursive: true, force: true });
  }
});

it("a downloaded update installs by itself at a quiet moment on macOS and Windows, and Linux installs stay the person's", async () => {
  const platform = Object.getOwnPropertyDescriptor(process, "platform");
  const resourcesPath = process.resourcesPath;
  const appImage = process.env.APPIMAGE;
  const resources = mkdtempSync(join(tmpdir(), "omb-updater-quiet-"));
  const quiet = { locked: () => true, idleMs: () => 0, typedAt: () => 0, shown: () => true, busy: () => null, work: async () => null, watch: () => {} };
  try {
    for (const [os, marker, image, installs] of [
      ["darwin", null, null, true],
      ["win32", null, null, true],
      ["linux", null, "/home/a/Rethos.AppImage", false],
      ["linux", "deb", null, false],
      ["linux", "rpm", null, false],
    ]) {
      Object.defineProperty(process, "platform", { ...platform, value: os });
      process.resourcesPath = resources;
      rmSync(join(resources, "package-type"), { force: true });
      if (marker) writeFileSync(join(resources, "package-type"), marker);
      if (image) process.env.APPIMAGE = image;
      else delete process.env.APPIMAGE;
      const { updater, autoUpdater, handlers } = await load(() => true);
      updater.startUpdater(quiet);
      await vi.advanceTimersByTimeAsync(15_000);
      await settle();
      expect(autoUpdater.quitAndInstall, `${os} ${marker ?? image ?? ""} waits for a quiet moment`).not.toHaveBeenCalled();
      expect((await handlers.get("update:get-state")({})).installsByItself, os).toBe(installs ? true : undefined);
      await vi.advanceTimersByTimeAsync(30_000);
      await settle();
      expect(autoUpdater.quitAndInstall.mock.calls, `${os} ${marker ?? image ?? ""}`).toEqual(installs ? [[true, true]] : []);
    }
  } finally {
    Object.defineProperty(process, "platform", platform);
    process.resourcesPath = resourcesPath;
    if (appImage === undefined) delete process.env.APPIMAGE;
    else process.env.APPIMAGE = appImage;
    rmSync(resources, { recursive: true, force: true });
  }
});

it("downloads an update by itself: the first check after launch starts it, and nothing restarts", async () => {
  const rule = mainRule();
  const local = page(LOCAL);
  rule.show(local);
  const { updater, autoUpdater } = await load(rule.pageAllowed);
  updater.attachUpdaterWindow(rule.window);
  updater.startUpdater();

  await vi.advanceTimersByTimeAsync(15_000);
  await settle();

  expect(autoUpdater.checkForUpdates).toHaveBeenCalledTimes(1);
  expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
  expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  const statuses = local.webContents.send.mock.calls.map(([, state]) => state.status);
  expect(statuses).not.toContain("available");
  expect(statuses.at(-1)).toBe("downloaded");
});

it("sends update news only to a page allowed to read it", async () => {
  const rule = mainRule();
  const { updater, autoUpdater, handlers } = await load(rule.pageAllowed);
  updater.attachUpdaterWindow(rule.window);
  updater.startUpdater();

  let finish;
  autoUpdater.downloadUpdate = vi.fn(() => new Promise((resolve) => { finish = resolve; }).then(() => {
    autoUpdater.emit("update-downloaded", { version: "2.0.0" });
    return ["/unused-staged-update.zip"];
  }));

  const other = page(OTHER);
  rule.show(other);
  await vi.advanceTimersByTimeAsync(15_000);
  await settle();
  expect(autoUpdater.downloadUpdate).toHaveBeenCalledTimes(1);
  expect(other.webContents.send).not.toHaveBeenCalled();
  expect(() => handlers.get("update:get-state")(other.event)).toThrow(/only available/);

  const cloud = page(CLOUD);
  rule.show(cloud, "cloud");
  expect(handlers.get("update:get-state")(cloud.event)).toMatchObject({ status: "downloading", version: "2.0.0" });
  finish();
  await settle();
  expect(cloud.webContents.send).toHaveBeenLastCalledWith("update:state", expect.objectContaining({ status: "downloaded", version: "2.0.0" }));
  expect(other.webContents.send).not.toHaveBeenCalled();
});

it("sends updater progress to a reopened window without restarting the updater", async () => {
  const rule = mainRule();
  const first = page(LOCAL);
  rule.show(first);
  const { updater, autoUpdater, handlers } = await load(rule.pageAllowed);
  updater.attachUpdaterWindow({ webContents: first.webContents });
  updater.startUpdater();
  const listenerCount = autoUpdater.eventNames().reduce((count, name) => count + autoUpdater.listenerCount(name), 0);
  const timerCount = vi.getTimerCount();

  first.webContents.send.mockImplementation(() => { throw new Error("window destroyed"); });
  first.webContents.send.mockClear();
  const reopened = page(LOCAL);
  rule.show(reopened);
  updater.attachUpdaterWindow(rule.window);

  await handlers.get("update:check")(reopened.event);
  await settle();

  expect(first.webContents.send).not.toHaveBeenCalled();
  expect(reopened.webContents.send.mock.calls.map(([, state]) => state.status))
    .toEqual(["checking", "downloading", "downloading", ...(process.platform === "darwin" ? ["preparing"] : []), "downloaded"]);
  expect(autoUpdater.eventNames().reduce((count, name) => count + autoUpdater.listenerCount(name), 0)).toBe(listenerCount);
  expect(vi.getTimerCount()).toBe(timerCount);
});

it("a server's page the window shows may ask for the app's own update: it learns only what was done, and nothing restarts unless the person says so", async () => {
  const rule = mainRule();
  const other = page(OTHER);
  rule.show(other, "vps");
  expect(rule.serverPage(other.event)).toBe(OTHER);
  expect(rule.serverPage({ sender: other.webContents, senderFrame: { url: `${CLOUD}/` } })).toBeNull();
  expect(rule.serverPage({ sender: page(OTHER).webContents, senderFrame: { url: `${OTHER}/` } })).toBeNull();
  const answers = [];
  const confirmRestart = vi.fn(async (version) => { answers.push(version); return answers.length > 1; });
  const { updater, autoUpdater, handlers } = await load(rule.pageAllowed, rule.serverPage, confirmRestart);
  const ask = handlers.get("update:for-server-page");
  await expect(Promise.resolve().then(() => ask({ sender: page(OTHER).webContents, senderFrame: { url: `${OTHER}/` } }))).rejects.toThrow(/only available/);
  expect(await ask(other.event)).toBe("unavailable");
  updater.attachUpdaterWindow(rule.window);
  updater.startUpdater();
  // Checked and downloaded at the page's request; the person said Not now. Five asks at once open one dialog, which
  // names the asking server.
  vi.advanceTimersByTime(updater.SERVER_PAGE_ASK_COOLDOWN_MS);
  expect(await Promise.all([1, 2, 3, 4, 5].map(() => ask(other.event)))).toEqual(["later", "later", "later", "later", "later"]);
  expect(confirmRestart).toHaveBeenCalledTimes(1);
  expect(confirmRestart).toHaveBeenCalledWith("2.0.0", OTHER);
  expect(await ask(other.event)).toBe("later");
  expect(confirmRestart).toHaveBeenCalledTimes(1);
  vi.advanceTimersByTime(updater.SERVER_PAGE_ASK_COOLDOWN_MS);
  expect(autoUpdater.quitAndInstall).not.toHaveBeenCalled();
  await settle();
  // Not the updater's state: the page never hears it, only what its own request did.
  expect(other.webContents.send).not.toHaveBeenCalled();
  expect(await ask(other.event)).toBe("installing");
  expect(confirmRestart).toHaveBeenLastCalledWith("2.0.0", OTHER);
  expect(autoUpdater.quitAndInstall).toHaveBeenCalledTimes(1);
});
