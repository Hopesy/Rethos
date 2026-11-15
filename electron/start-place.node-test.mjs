import assert from "node:assert/strict";
import test from "node:test";

import { openStartPlace } from "./start-place.mjs";
test("launch restores a saved server or local profile without an account", async () => {
  for (const last of [{ server: "vps" }, { profile: "work" }]) {
    const opened = [];
    const result = await openStartPlace({ places: { remembered: () => last, remember: () => assert.fail("keep the selection") },
      profiles: { open: async id => { opened.push(id); return true; } }, server: async id => { opened.push(id); return true; }, show: () => assert.fail("already restored") });
    assert.equal(result, "remembered"); assert.deepEqual(opened, Object.values(last));
  }
});
test("an unavailable server falls back once and clears its saved startup selection", async () => {
  let remembered = { server: "offline" }, shown = 0;
  assert.equal(await openStartPlace({ places: { remembered: () => remembered, remember: value => { remembered = value; } }, profiles: null,
    server: async () => { throw Error("offline"); }, show: async () => { shown++; } }), "home");
  assert.equal(shown, 1); assert.equal(remembered, null);
});
