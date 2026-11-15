import assert from "node:assert/strict";
import test from "node:test";

import { installPlaceLook, placeLook, swatchOf } from "./place-look.mjs";
test("saved server colors are maintained locally", async () => {
  let entry = { id: "vps", name: "VPS", kind: "remote", origin: "https://vps.test", color: "teal" };
  const handlers = new Map();
  installPlaceLook({ ipcMain: { handle: (key, handler) => handlers.set(key, handler) }, guard: fn => fn, place: () => entry,
    save: (id, color) => { assert.equal(id, entry.id); entry = { ...entry, color }; },
    rail: { owns: event => event === "rail", places: () => [{ id: "vps", paint: {} }], saved: id => id === "vps" ? entry : null } });
  assert.equal(swatchOf("teal"), "green"); assert.equal(placeLook(entry).change, "local");
  const result = await handlers.get("workspaces:recolor")("rail", "vps", "rose");
  assert.equal(result.outcome, "saved"); assert.equal(entry.color, "red");
  assert.throws(() => handlers.get("workspaces:recolor")("page", "vps", "rose"), /only available/);
  await assert.rejects(handlers.get("workspaces:color")("page", "invalid"));
});
