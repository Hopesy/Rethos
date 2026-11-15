import assert from "node:assert/strict";
import test from "node:test";

import { railPlaces, installCloudRail } from "./cloud-rail.mjs";
const saved = { activeId: "vps", environments: [{ id: "vps", kind: "remote", name: "VPS", origin: "https://vps.test", color: "teal" }] };
test("the rail lists this computer, local profiles and saved servers without exposing addresses", () => {
  const rows = railPlaces({ saved, profiles: [{ id: "work", name: "Work", active: true }], offers: () => true, waiting: id => id === "vps" });
  assert.deepEqual(rows.map(row => [row.id, row.kind]), [["local", "computer"], ["profile:work", "computer"], ["vps", "server"]]);
  assert.equal(rows[2].makeHome, true); assert.equal(rows[2].attention, true);
  assert.equal(JSON.stringify(rows).includes("https://"), false);
});
test("only the rail can open listed places and it receives the actual switch result", async () => {
  const handlers = new Map(), opened = [], changes = [];
  const api = installCloudRail({ ipcMain: { handle: (key, handler) => handlers.set(key, handler) }, guard: fn => fn,
    trusted: event => event === "rail", lists: event => event === "rail", places: () => railPlaces({ saved }),
    open: async id => opened.push(id), add: { choices: () => ({ link: true, address: true }) },
    targets: () => [{ isDestroyed: () => false, send: key => changes.push(key) }] });
  assert.deepEqual(await handlers.get("workspaces:open")("rail", "vps"), { outcome: "switched" });
  assert.deepEqual(opened, ["vps"]);
  assert.throws(() => handlers.get("workspaces:open")("page", "vps"), /only available/);
  await assert.rejects(handlers.get("workspaces:open")("rail", "missing"));
  assert.deepEqual(handlers.get("workspaces:places")("page").places, []);
  assert.equal([...handlers.keys()].some(key => key.startsWith("cloud-add:")), false);
  api.changed(); api.changed(); assert.equal(changes.length, 1);
});
