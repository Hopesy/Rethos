import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import vm from "node:vm";
import localOrigin from "./local-origin.cjs";
import environments from "./environments.cjs";
import { randomUUID } from "node:crypto";
import { createCompanyBackupSchedule } from "./company-backup-schedule.mjs";

// Production main functions without importing Electron main (which would start the app); all IO is synthetic.
// Windows checkouts can have CRLF line endings; the source checks below match "\n".
const mainSource = readFileSync(new URL("./main.mjs", import.meta.url), "utf8").replace(/\r\n/g, "\n");
function section(start, end) {
  const from = mainSource.indexOf(start);
  const to = mainSource.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from, `Main-process test section moved: ${start}`);
  return mainSource.slice(from, to);
}
const functions = section("function ensureManagedDesktop()", "function syncDesktopMutationToken(");
const registrations = section("const workspaceOnly =", "const savedWorkspace =");
const ORIGIN = "http://127.0.0.1:48799";
const STAGE = "11111111-1111-4111-8111-111111111111";
const DEVICE = "22222222-2222-4222-8222-222222222222";

function fixture() {
  const handlers = new Map(), sent = [], requests = [];
  const frame = { url: `${ORIGIN}/` };
  const contents = { mainFrame: frame, send: (...args) => sent.push(args) };
  const event = { sender: contents, senderFrame: frame };
  const f = {
    connection: { deviceId: DEVICE, organizationId: "fixture-org", portalOrigin: "https://company.example.test", email: "fixture@example.test", expiresAt: Date.now() + 60_000 },
    state: { status: "connected", cloudBackups: true },
    status: { busy: false, pendingRestore: false },
    transfer: async () => ({ id: STAGE, summary: {} }),
    restoreResponse: async () => Response.json({ restoreId: STAGE }),
    onState: null, requests, sent, event, generation: 0, savedSchedule: null, scheduleOptions: null,
    now: Date.now(), scheduleTimer: null, statusResponse: null,
    stores: [], clientOptions: null, libraryOptions: null, libraryFetches: [], librarySent: [],
    library: { runtimeReady: () => {}, receive: () => false, close: () => {} },
  };
  const client = { connection: () => f.connection, state: () => f.state, backupGeneration: () => f.generation,
    fetchLibraryBytes: async (...args) => { f.libraryFetches.push(args); return Buffer.from("{}"); },
    disconnect: async () => { f.generation++; f.connection = null; f.state = { status: "signed-out" }; f.onState(f.state); return f.state; } };
  localOrigin.setLocalOrigin(ORIGIN);
  const context = vm.createContext({
    AbortController, AbortSignal, Date, Headers, setTimeout, clearTimeout, path, randomUUID, Buffer,
    app: { isPackaged: true, getPath: () => "/unused-synthetic-backup-fixture", getVersion: () => "fixture" },
    os: { hostname: () => "Fixture computer" }, process: { platform: "fixture" },
    createManagedDesktopStore: options => {
      const store = { file: options.file, read: async () => f.savedSchedule, write: async value => { f.savedSchedule = structuredClone(value); } };
      f.stores.push(store);
      return store;
    },
    createManagedDesktopClient: options => { f.onState = options.onState; f.clientOptions = options; return client; },
    createOrgLibrary: options => { f.libraryOptions = options; return f.library; },
    managedDesktopRelay: { sendLibrary: async (proc, library) => { f.librarySent.push({ proc, library }); } },
    installCloudPlanIpc: () => {},
    createCompanyBackupSchedule: options => {
      f.scheduleOptions = options;
      return createCompanyBackupSchedule({ ...options, now: () => f.now,
        setTimer: callback => { f.scheduleTimer = callback; return 1; }, clearTimer: () => { f.scheduleTimer = null; } });
    },
    createCompanyBackups: () => ({ backup: (...args) => f.transfer(...args), prepareRestore: (...args) => f.transfer(...args) }),
    managedDesktop: null, companyBackupController: null, preparedCompanyRestore: null,
    companyBackupSchedule: null, companyBackupClientStateRequest: null, companyRestoreCommitting: false, desktopShutdownStarted: false, companyBackupConfigurationRevision: 0,
    desktopDataDir: () => "/synthetic-fixture-workspace",
    companyBackupState: { busy: false }, serverProc: {}, serverReady: true,
    desktopRemoteAccess: null, mainWindow: { webContents: contents, isDestroyed: () => false },
    rendererOrigin: () => ORIGIN, environmentsState: { environments: [], activeId: "local" },
    activeEnvironment: environments.activeEnvironment, activeRemote: environments.activeRemote, workspaceSenderAllowed: environments.workspaceSenderAllowed,
    localOnly: localOrigin.localOnly, ipcMain: { handle: (channel, handler) => handlers.set(channel, handler), on: (channel, handler) => handlers.set(channel, handler) },
    SERVER_PORT: 48799, DESKTOP_MUTATION_HEADER: "x-fixture-desktop-mutation", desktopMutationToken: "synthetic-local-only",
    fetch: async (url, options) => {
      assert.equal(new URL(url).origin, ORIGIN, "No external network or live workspace is permitted");
      requests.push({ url, options });
      if (url.endsWith("/status")) return f.statusResponse ? f.statusResponse() : Response.json(f.status);
      assert.equal(url, `${ORIGIN}/api/workspace-backup/restore`);
      return f.restoreResponse();
    },
  });
  vm.runInContext(`${functions}\n${registrations}`, context, { filename: "main.mjs (company backup boundary fixture)" });
  context.ensureManagedDesktop();
  return Object.assign(f, {
    context,
    invoke: (channel, input, sender = event) => handlers.get(`company-backups:${channel}`)(sender, input),
    prepare: () => { context.preparedCompanyRestore = { id: STAGE, proc: context.serverProc, deviceId: DEVICE }; },
  });
}

test("ensureManagedDesktop gives the organization library its own record, the fixed-route client and the local runtime", async () => {
  const f = fixture(), options = f.libraryOptions;
  assert.equal(options.dataDir, path.join("/synthetic-fixture-workspace", "org-library"));
  assert.deepEqual(f.stores.map(store => path.basename(store.file)), ["company-connection.bin", "company-library.bin", "company-backup-schedule.bin"]);
  assert.equal(options.store, f.stores[1], "a separate OS-encrypted record, not the connection's");
  assert.equal(f.clientOptions.store, f.stores[0]);
  assert.equal(f.clientOptions.library, f.library, "every session sync reaches the library");
  assert.equal(options.appVersion, "fixture");
  await options.fetchBytes("/api/desktop/library", 1024, { generation: 3 });
  assert.deepEqual(f.libraryFetches, [["/api/desktop/library", 1024, { generation: 3 }]], "downloads go through the client's fixed routes");
  const library = { digest: "d".repeat(64) };
  await options.relay(library);
  assert.equal(f.librarySent.length, 1);
  assert.equal(f.librarySent[0].proc, f.context.serverProc, "only to the current local runtime");
  assert.equal(f.librarySent[0].library, library);
});

test("main hands the library a restarted runtime, the runtime's own messages and the quit", () => {
  // Outside ensureManagedDesktop(), so checked in the source.
  assert.match(section("onReady(proc) {", "routineWake.start();"), /\n\s*orgLibrary\?\.runtimeReady\(\);\n/);
  const messages = section('proc.on("message", (message) => {', 'proc.once("spawn"');
  assert.match(messages, /if \(!serverSupervisor\.isCurrent\(proc\)\) return;/, "a replaced runtime's messages are dropped first");
  assert.match(messages, /\n\s*if \(orgLibrary\?\.receive\(message\)\) return;\n/);
  assert.match(section('app.on("before-quit"', "managedDesktop?.close();"), /\n\s*orgLibrary\?\.close\(\);\n/);
});

for (const channel of ["configure-schedule", "state", "list", "create", "preview", "cancel", "delete", "restore"]) {
  test(`self-hosted desktop refuses company-backups:${channel} before performing IO`, () => {
    const f = fixture();
    assert.throws(() => f.invoke(channel, { enabled: true, id: STAGE, confirmation: "REPLACE" }), /self-hosted/);
    assert.deepEqual(f.requests, []);
    assert.deepEqual(f.sent, []);
    assert.equal(f.savedSchedule, null);
    assert.equal(f.context.companyBackupController, null);
    assert.equal(f.context.preparedCompanyRestore, null);
  });
}
