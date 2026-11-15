import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { openStartPlace } from "./start-place.mjs";
import { jsonFile } from "./desktop-prefs.mjs";

test("an absent or unreadable startup selection still opens the default workspace", async t => {
  const root = mkdtempSync(join(tmpdir(), "rethos-startup-")), file = join(root, "home-place.json");
  t.after(() => rmSync(root, { recursive: true, force: true }));
  for (const contents of [undefined, "invalid json"]) {
    if (contents !== undefined) writeFileSync(file, contents);
    let shown = 0;
    const result = await openStartPlace({ places: { remembered: jsonFile(file).read, remember: () => assert.fail("preserve the record") },
      profiles: null, server: () => assert.fail("no server selected"), show: async () => { shown++; } });
    assert.equal(result, "home");
    assert.equal(shown, 1);
  }
});
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
